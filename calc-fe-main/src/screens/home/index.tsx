import { ColorSwatch, Group } from '@mantine/core';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Draggable from 'react-draggable';
import { SWATCHES } from '@/constants';

interface GeneratedResult {
    expression: string;
    answer: string;
}

interface Response {
    expr: string;
    result: string;
    assign: boolean;
}

interface LatexElement {
    id: string;
    content: string;
    position: { x: number; y: number };
}

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('rgb(255, 255, 255)');
    const [brushSize, setBrushSize] = useState(3);
    const [isErasing, setIsErasing] = useState(false);
    const [reset, setReset] = useState(false);
    const [dictOfVars, setDictOfVars] = useState<Record<string, string>>({});
    const [result, setResult] = useState<GeneratedResult>();
    const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
    const [latexElements, setLatexElements] = useState<LatexElement[]>([]);
    const [canvasSnapshot, setCanvasSnapshot] = useState<ImageData | null>(null);

    // MathJax setup
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML';
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            window.MathJax.Hub.Config({
                tex2jax: {
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['\\[', '\\]']],
                    processEscapes: true
                },
                CommonHTML: { scale: 150 }
            });
        };

        return () => {
            document.head.removeChild(script);
        };
    }, []);

    // Handle resize
    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setCanvasSnapshot(imageData);

            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight - canvas.offsetTop;

            if (canvasSnapshot) {
                ctx.putImageData(canvasSnapshot, 0, 0);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [canvasSnapshot]);

    // Canvas setup
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight - canvas.offsetTop;
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.lineCap = 'round';
            }
        }
    }, []);

    // Update MathJax when elements change
    useEffect(() => {
        if (typeof window.MathJax !== 'undefined') {
            window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
        }
    }, [latexElements]);

    // Handle results
    useEffect(() => {
        if (result) {
            renderLatexToCanvas(result.expression, result.answer);
        }
    }, [result]);

    // Reset handler
    useEffect(() => {
        if (reset) {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = 'black';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
            }
            setLatexElements([]);
            setResult(undefined);
            setDictOfVars({});
            setLatexPosition({ x: 10, y: 200 });
            setReset(false);
        }
    }, [reset]);

    const renderLatexToCanvas = (expression: string, answer: string) => {
        const newElement: LatexElement = {
            id: Date.now().toString(),
            content: `\\[\\text{${expression}} = \\text{${answer}}\\]`,
            position: latexPosition
        };
        setLatexElements(prev => [...prev, newElement]);
    };

    const saveCanvasState = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
    
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setCanvasSnapshot(imageData);
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        saveCanvasState();
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                ctx.lineWidth = brushSize;
                ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
                ctx.strokeStyle = isErasing ? 'rgba(0, 0, 0, 1)' : color;
                setIsDrawing(true);
            }
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                ctx.stroke();
            }
        }
    };

    const stopDrawing = () => setIsDrawing(false);

    const toggleErase = () => {
        setIsErasing(!isErasing);
        if (!isErasing) setColor('rgba(0, 0, 0, 1)');
    };

    const handleBrushSizeChange = (size: number) => {
        setBrushSize(Math.max(1, Math.min(50, size)));
    };

    const runRoute = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/calculate`,
                {
                    image: canvas.toDataURL('image/png'),
                    dict_of_vars: dictOfVars
                }
            );

            const resp = response.data;
            resp.data.forEach((data: Response) => {
                if (data.assign) {
                    setDictOfVars(prev => ({ ...prev, [data.expr]: data.result }));
                }
            });

            const ctx = canvas.getContext('2d');
            const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
            
            let [minX, minY, maxX, maxY] = [canvas.width, canvas.height, 0, 0];
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const i = (y * canvas.width + x) * 4;
                    if (imageData.data[i + 3] > 0) {
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }

            setLatexPosition({
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2
            });

            resp.data.forEach((data: Response) => {
                setTimeout(() => {
                    setResult({
                        expression: data.expr,
                        answer: data.result
                    });
                    setLatexPosition(prev => ({ 
                        x: prev.x + 50, 
                        y: prev.y + 50 
                    }));
                }, 1000);
            });
        } catch (error) {
            console.error('Error processing calculation:', error);
        }
    };

    return (
        <>
            <div className='grid grid-cols-4 gap-2 items-center p-4 bg-gray-800 relative z-30'>
                <Button onClick={() => setReset(true)} className='bg-red-600 hover:bg-red-700'>
                    Reset Canvas
                </Button>
                
                <Group>
                    {SWATCHES.map((swatch) => (
                        <ColorSwatch
                            key={swatch}
                            color={swatch}
                            onClick={() => {
                                setColor(swatch);
                                setIsErasing(false);
                            }}
                            style={{ cursor: 'pointer' }}
                        />
                    ))}
                </Group>

                <Group className='space-x-4'>
                    <Button 
                        onClick={toggleErase}
                        className={`${isErasing ? 'bg-blue-600' : 'bg-gray-600'} hover:bg-opacity-80`}
                    >
                        {isErasing ? 'Erasing Mode' : 'Toggle Eraser'}
                    </Button>
                    <div className='flex items-center space-x-2'>
                        <input
                            type="range"
                            min="1"
                            max="50"
                            value={brushSize}
                            onChange={(e) => handleBrushSizeChange(parseInt(e.target.value))}
                            className="w-32"
                        />
                        <span className="text-white">Brush Size: {brushSize}px</span>
                    </div>
                </Group>

                <Button onClick={runRoute} className='bg-green-600 hover:bg-green-700'>
                    Calculate
                </Button>
            </div>

            <canvas
                ref={canvasRef}
                className='absolute top-0 left-0 w-full h-full bg-black cursor-crosshair z-20'
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
            />

            {latexElements.map((element) => (
                <Draggable
                    key={element.id}
                    position={element.position}
                    onStop={(_, data) => {
                        setLatexElements(prev => 
                            prev.map(el => 
                                el.id === element.id 
                                    ? { ...el, position: { x: data.x, y: data.y } } 
                                    : el
                            )
                        );
                    }}
                >
                    <div className="absolute p-4 bg-gray-800 rounded-lg shadow-xl border border-gray-600 z-40 transform hover:scale-105 transition-transform group">
                        <button 
                            onClick={() => setLatexElements(prev => prev.filter(el => el.id !== element.id))}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            ×
                        </button>
                        <div className="text-white text-xl" dangerouslySetInnerHTML={{ __html: element.content }} />
                    </div>
                </Draggable>
            ))}
        </>
    );
}