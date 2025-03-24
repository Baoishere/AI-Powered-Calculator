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

interface CanvasState {
    imageData: ImageData;
    latexElements: LatexElement[];
}

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('rgb(255, 255, 255)');
    const [brushSize, setBrushSize] = useState(3);
    const [isErasing, setIsErasing] = useState(false);
    const [mode, setMode] = useState<'free' | 'line' | 'circle' | 'rectangle' | 'text'>('free');
    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
    const [textInput, setTextInput] = useState('');
    const [showTextInput, setShowTextInput] = useState(false);
    const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
    const [reset, setReset] = useState(false);
    const [dictOfVars, setDictOfVars] = useState<Record<string, string>>({});
    const [result, setResult] = useState<GeneratedResult>();
    const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
    const [latexElements, setLatexElements] = useState<LatexElement[]>([]);
    const [history, setHistory] = useState<CanvasState[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

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

    // Canvas setup
useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight - 64; // Thanh công cụ cao 4rem (64px)
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.lineCap = 'round';
            saveToHistory();
        }
    }
}, []);

// Handle resize
useEffect(() => {
    const handleResize = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - 64; // Thanh công cụ cao 4rem (64px)
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
}, []);

    // Update MathJax
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
            setHistory([]);
            setHistoryIndex(-1);
            setReset(false);
        }
    }, [reset]);

    const saveToHistory = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
    
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
    
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const newHistory = history.slice(0, historyIndex + 1); // Xóa các trạng thái tương lai
        newHistory.push({ imageData, latexElements: [...latexElements] });
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIndex <= 0) return;
    
        const canvas = canvasRef.current;
        if (!canvas) return;
    
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
    
        const newIndex = historyIndex - 1;
        const state = history[newIndex];
        if (!state || !state.imageData) return;
    
        ctx.putImageData(state.imageData, 0, 0);
        setLatexElements(state.latexElements || []);
        setHistoryIndex(newIndex);
    };

    const redo = () => {
        if (historyIndex >= history.length - 1) return; // Không còn trạng thái để redo
    
        const canvas = canvasRef.current;
        if (!canvas) return;
    
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
    
        const newIndex = historyIndex + 1;
        const state = history[newIndex];
        if (!state || !state.imageData) return; // Kiểm tra trạng thái có hợp lệ không
    
        ctx.putImageData(state.imageData, 0, 0);
        setLatexElements(state.latexElements || []); // Đặt giá trị mặc định nếu latexElements không tồn tại
        setHistoryIndex(newIndex);
    };

    const renderLatexToCanvas = (expression: string, answer: string) => {
        const newElement: LatexElement = {
            id: Date.now().toString(),
            content: `\\[\\text{${expression}} = \\text{${answer}}\\]`,
            position: latexPosition
        };
        setLatexElements(prev => [...prev, newElement]);
        saveToHistory();
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
    
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
    
        // Tính tọa độ chính xác của chuột so với canvas
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
    
        if (mode === 'text') {
            setTextPos({ x, y });
            setShowTextInput(true);
            return;
        }
    
        saveToHistory();
        setStartPos({ x, y });
    
        if (mode === 'free') {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineWidth = brushSize;
            ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
            ctx.strokeStyle = isErasing ? 'rgba(0, 0, 0, 1)' : color;
            setIsDrawing(true);
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
    
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
    
        // Tính tọa độ chính xác của chuột so với canvas
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
    
        if (mode === 'free' && isDrawing) {
            ctx.lineTo(x, y);
            ctx.stroke();
        } else if (startPos && (mode === 'line' || mode === 'circle' || mode === 'rectangle')) {
            ctx.putImageData(history[historyIndex].imageData, 0, 0);
            ctx.lineWidth = brushSize;
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
    
            if (mode === 'line') {
                ctx.beginPath();
                ctx.moveTo(startPos.x, startPos.y);
                ctx.lineTo(x, y);
                ctx.stroke();
            } else if (mode === 'circle') {
                const radius = Math.sqrt((x - startPos.x) ** 2 + (y - startPos.y) ** 2);
                ctx.beginPath();
                ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
                ctx.stroke();
            } else if (mode === 'rectangle') {
                ctx.beginPath();
                ctx.rect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
                ctx.stroke();
            }
        }
    };

    const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (mode === 'free') {
            setIsDrawing(false);
            saveToHistory();
        } else if (startPos && (mode === 'line' || mode === 'circle' || mode === 'rectangle')) {
            const canvas = canvasRef.current;
            if (!canvas) return;
    
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
    
            const x = e.nativeEvent.offsetX;
            const y = e.nativeEvent.offsetY;
    
            ctx.lineWidth = brushSize;
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
    
            if (mode === 'line') {
                ctx.beginPath();
                ctx.moveTo(startPos.x, startPos.y);
                ctx.lineTo(x, y);
                ctx.stroke();
            } else if (mode === 'circle') {
                const radius = Math.sqrt((x - startPos.x) ** 2 + (y - startPos.y) ** 2);
                ctx.beginPath();
                ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
                ctx.stroke();
            } else if (mode === 'rectangle') {
                ctx.beginPath();
                ctx.rect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
                ctx.stroke();
            }
    
            saveToHistory();
            setStartPos(null);
        }
    };

    const handleTextSubmit = () => {
        if (!textInput || !textPos) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        saveToHistory();
        ctx.font = `${brushSize * 5}px Arial`;
        ctx.fillStyle = color;
        ctx.fillText(textInput, textPos.x, textPos.y);
        saveToHistory();

        setTextInput('');
        setShowTextInput(false);
        setTextPos(null);
    };

    const toggleErase = () => {
        setIsErasing(!isErasing);
        setMode('free');
        if (!isErasing) setColor('rgba(0, 0, 0, 1)');
    };

    const handleBrushSizeChange = (size: number) => {
        setBrushSize(Math.max(1, Math.min(50, size)));
    };

    const runRoute = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            // const response = await axios.post(
            //     `${import.meta.env.VITE_API_URL}/calculate`, //backend local
            const response = await axios.post("https://ai-powered-calculator-43a7.onrender.com/calculate", //backend render
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
        <div className="relative w-full h-screen bg-gray-900">
            {/* Toolbar */}
            <div className="fixed top-0 left-0 w-full p-2 bg-gray-800 shadow-lg z-30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    {/* Left Section: Drawing Tools */}
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setMode('free')}
                            className={`px-3 py-1 ${mode === 'free' ? 'bg-blue-600' : 'bg-gray-600'} hover:bg-opacity-80 text-white rounded`}
                        >
                            Free Draw
                        </Button>
                        <Button
                            onClick={() => setMode('line')}
                            className={`px-3 py-1 ${mode === 'line' ? 'bg-blue-600' : 'bg-gray-600'} hover:bg-opacity-80 text-white rounded`}
                        >
                            Line
                        </Button>
                        <Button
                            onClick={() => setMode('circle')}
                            className={`px-3 py-1 ${mode === 'circle' ? 'bg-blue-600' : 'bg-gray-600'} hover:bg-opacity-80 text-white rounded`}
                        >
                            Circle
                        </Button>
                        <Button
                            onClick={() => setMode('rectangle')}
                            className={`px-3 py-1 ${mode === 'rectangle' ? 'bg-blue-600' : 'bg-gray-600'} hover:bg-opacity-80 text-white rounded`}
                        >
                            Rectangle
                        </Button>
                        <Button
                            onClick={() => setMode('text')}
                            className={`px-3 py-1 ${mode === 'text' ? 'bg-blue-600' : 'bg-gray-600'} hover:bg-opacity-80 text-white rounded`}
                        >
                            Text
                        </Button>
                    </div>

                    {/* Center Section: Color, Brush, Eraser */}
                    <div className="flex items-center gap-2">
                        <Group>
                            {SWATCHES.map((swatch) => (
                                <ColorSwatch
                                    key={swatch}
                                    color={swatch}
                                    onClick={() => {
                                        setColor(swatch);
                                        setIsErasing(false);
                                    }}
                                    className="cursor-pointer hover:scale-110 transition-transform"
                                />
                            ))}
                        </Group>
                        <Button
                            onClick={toggleErase}
                            className={`px-3 py-1 ${isErasing ? 'bg-blue-600' : 'bg-gray-600'} hover:bg-opacity-80 text-white rounded`}
                        >
                            {isErasing ? 'Erasing' : 'Eraser'}
                        </Button>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="1"
                                max="50"
                                value={brushSize}
                                onChange={(e) => handleBrushSizeChange(parseInt(e.target.value))}
                                className="w-24 accent-blue-600"
                            />
                            <span className="text-white text-sm">Brush: {brushSize}px</span>
                        </div>
                    </div>

                    {/* Right Section: Undo, Redo, Reset, Calculate */}
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={undo}
                            disabled={historyIndex <= 0}
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded disabled:opacity-50"
                        >
                            Undo
                        </Button>
                        <Button
                            onClick={redo}
                            disabled={historyIndex >= history.length - 1}
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded disabled:opacity-50"
                        >
                            Redo
                        </Button>
                        <Button
                            onClick={() => setReset(true)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                        >
                            Reset
                        </Button>
                        <Button
                            onClick={runRoute}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
                        >
                            Calculate
                        </Button>
                    </div>
                </div>
            </div>

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                className="absolute top-16 left-0 w-full h-[calc(100%-4rem)] bg-black cursor-crosshair z-20"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
            />

            {/* Text Input Modal */}
            {showTextInput && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-700 p-4 rounded-lg shadow-lg z-50">
                    <input
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="Enter text"
                        className="p-2 rounded bg-gray-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2 mt-2">
                        <Button
                            onClick={handleTextSubmit}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                        >
                            Add Text
                        </Button>
                        <Button
                            onClick={() => {
                                setShowTextInput(false);
                                setTextInput('');
                                setTextPos(null);
                            }}
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded"
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {/* Latex Elements */}
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
        </div>
    );
}
