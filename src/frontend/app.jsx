const { useRef, useEffect, useState } = React;

const getWebSocketURL = () => {
	const url = new URL(window.location.href);
	const hostname = url.hostname.replace('-web', '-moshi-web');
	const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

	return `${protocol}//${hostname}/ws`;
}

const App = () => {
	const [audioContext] = useState(() => new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 }));
	const [text, setText] = useState('');

	const socketRef = useRef(null);
	const decoderRef = useRef(null);
	const scheduledEndRef = useRef(null);

	const startRecording = async () => {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

		const rec = new Recorder({
			encoderPath: "https://cdn.jsdelivr.net/npm/opus-recorder@latest/dist/encoderWorker.min.js",
			streamPages: true,
			encoderApplication: 2049,
			encoderFrameSize: 80,
			encoderSampleRate: 24000,
			maxFramesPerPage: 1,
			numberOfChannels: 1,
		});

		rec.ondataavailable = async (data) => {
			if (socketRef.current?.readyState === WebSocket.OPEN) {
				await socketRef.current.send(data);
			}
		};

		await rec.start();
	};

	useEffect(() => {
		const init = async () => {
			const decoder = new window['ogg-opus-decoder'].OggOpusDecoder();
			await decoder.ready;

			decoderRef.current = decoder;
		};
		init();
		return () => decoderRef.current?.free();
	}, []);

	const playAudio = (audioData)=> {
		const buffer = audioContext.createBuffer(1, audioData.length, audioContext.sampleRate);
		buffer.copyToChannel(audioData, 0);

		const source = audioContext.createBufferSource();
		source.buffer = buffer;
		source.connect(audioContext.destination);

		const startTime = Math.max(scheduledEndRef.current, audioContext.currentTime);
		source.start(startTime);
		scheduledEndRef.current = startTime + buffer.duration;
	};

	useEffect(() => {
		const socket = new WebSocket(getWebSocketURL());
		socketRef.current = socket;

		socket.onopen = () => startRecording();

		socket.onmessage = async (event) => {
			const buffer = await event.data.arrayBuffer();
			const tag = new Uint8Array(buffer)[0];
			const payload = buffer.slice(1);

			if (tag === 1) {
				const { channelData, samplesDecoded } = await decoderRef.current.decode(new Uint8Array(payload));
				if (samplesDecoded > 0) playAudio(channelData[0]);
			} else if (tag === 2) {
				const newText = new TextDecoder().decode(payload);
				setText(prev => prev + newText);
			}
		};

		return () => socket.close();
	}, []);

    return (
        <div className="relative bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white min-h-screen flex items-center justify-center p-4 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob top-0 -left-4"></div>
                <div className="absolute w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 top-0 -right-4"></div>
                <div className="absolute w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000 bottom-0 left-20"></div>
            </div>

            <div className="relative z-10 bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-xl p-8 border border-gray-700/50 transition-all duration-500 hover:scale-105 hover:shadow-purple-500/20 hover:border-purple-500/50 group">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/0 via-purple-500/10 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
                
                <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="relative">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                        </div>
                        <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                            {text ? 'Connected' : 'Connecting...'}
                        </span>
                    </div>

                    <p className="text-gray-200 break-words leading-relaxed text-lg font-light">
                        {text || 'Connecting...'}
                    </p>

                    <div className="mt-6 flex items-center justify-between">
                        <div className="flex gap-1">
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse"></div>
                        </div>
                        
                        <div className="text-xs text-gray-500 font-mono">
                            {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                </div>

                <div className="absolute top-3 right-3 w-16 h-16 border-t-2 border-r-2 border-purple-500/30 rounded-tr-2xl"></div>
                <div className="absolute bottom-3 left-3 w-16 h-16 border-b-2 border-l-2 border-blue-500/30 rounded-bl-2xl"></div>
            </div>
        </div>
    );

};

ReactDOM.createRoot(document.getElementById("react")).render(<App />);