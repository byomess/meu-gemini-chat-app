// src/hooks/useAudioRecording.ts
import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioRecordingProps {
    addFilesToState: (files: File[], isRecordedAudio: boolean) => Promise<void>;
    onRecordingStateChange?: (isRecording: boolean) => void; // Optional callback
    focusTextarea?: () => void;
}

export function useAudioRecording({ addFilesToState, onRecordingStateChange, focusTextarea }: UseAudioRecordingProps) {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [audioError, setAudioError] = useState<string | null>(null);
    const [recordingTime, setRecordingTime] = useState<number>(0); // NOVO: Estado para o tempo de gravação

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const wasCancelledRef = useRef<boolean>(false);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null); // NOVO: Ref para o ID do intervalo

    const stopMediaStream = useCallback(() => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
    }, []);

    const startRecording = async () => {
        setAudioError(null);
        wasCancelledRef.current = false;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setAudioError("Gravação de áudio não é suportada neste navegador.");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            const options = MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
                ? { mimeType: 'audio/ogg; codecs=opus' }
                : MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
                    ? { mimeType: 'audio/webm; codecs=opus' }
                    : MediaRecorder.isTypeSupported('audio/mp4')
                        ? { mimeType: 'audio/mp4' }
                        : {};
            mediaRecorderRef.current = new MediaRecorder(stream, options);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) { audioChunksRef.current.push(event.data); }
            };

            mediaRecorderRef.current.onstop = async () => {
                stopMediaStream();
                setIsRecording(false);
                onRecordingStateChange?.(false);
                // NOVO: Limpar o intervalo ao parar
                if (recordingIntervalRef.current) {
                    clearInterval(recordingIntervalRef.current);
                    recordingIntervalRef.current = null;
                }

                if (wasCancelledRef.current) {
                    wasCancelledRef.current = false;
                    audioChunksRef.current = [];
                    focusTextarea?.();
                    return;
                }
                if (!mediaRecorderRef.current) return;

                const audioMimeType = mediaRecorderRef.current.mimeType || 'audio/ogg';
                const audioBlob = new Blob(audioChunksRef.current, { type: audioMimeType });
                audioChunksRef.current = [];

                if (audioBlob.size === 0) {
                    setAudioError("Gravação resultou em áudio vazio. Tente novamente.");
                    focusTextarea?.();
                    return;
                }

                const audioExtension = audioMimeType.split('/')[1]?.split(';')[0] || 'ogg';
                const audioFileName = `gravacao_${Date.now()}.${audioExtension}`;
                const recordedAudioFile = new File([audioBlob], audioFileName, { type: audioMimeType });

                await addFilesToState([recordedAudioFile], true);
                focusTextarea?.();
            };

            mediaRecorderRef.current.onerror = (event: Event) => {
                console.error("MediaRecorder error:", event);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const specificError = (event as any).error;
                setAudioError(`Erro na gravação: ${specificError?.name || specificError?.message || 'Erro desconhecido'}`);
                stopMediaStream();
                setIsRecording(false);
                onRecordingStateChange?.(false);
                // NOVO: Limpar o intervalo em caso de erro
                if (recordingIntervalRef.current) {
                    clearInterval(recordingIntervalRef.current);
                    recordingIntervalRef.current = null;
                }
                focusTextarea?.();
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            onRecordingStateChange?.(true);
            // NOVO: Iniciar o contador de tempo
            setRecordingTime(0); // Resetar o tempo ao iniciar uma nova gravação
            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prevTime => prevTime + 1);
            }, 1000);

        } catch (err: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const error = err as any;
            console.error("Erro ao acessar microfone:", error);
            if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
                setAudioError("Permissão para microfone negada. Habilite nas configurações do navegador.");
            } else if (error.name === "NotFoundError") {
                setAudioError("Nenhum dispositivo de áudio encontrado.");
            } else {
                setAudioError("Não foi possível acessar o microfone.");
            }
            setIsRecording(false);
            onRecordingStateChange?.(false);
            stopMediaStream();
            // NOVO: Limpar o intervalo em caso de erro ao iniciar
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }
        }
    };

    const stopRecordingAndAttach = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            wasCancelledRef.current = false;
            mediaRecorderRef.current.stop();
        }
        // NOVO: Limpar o intervalo ao parar (garantia, pois onstop também faz)
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }
    };

    const handleCancelRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            wasCancelledRef.current = true;
            mediaRecorderRef.current.stop();
        } else {
            stopMediaStream();
            setIsRecording(false);
            onRecordingStateChange?.(false);
            audioChunksRef.current = [];
        }
        // NOVO: Limpar o intervalo ao cancelar
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }
        setAudioError(null);
        focusTextarea?.();
    };
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop();
            }
            stopMediaStream();
            mediaRecorderRef.current = null;
            audioChunksRef.current = [];
            // NOVO: Limpar o intervalo ao desmontar
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }
        };
    }, [stopMediaStream]);

    return {
        isRecording,
        audioError,
        setAudioError,
        startRecording,
        stopRecordingAndAttach,
        handleCancelRecording,
        stopMediaStream,
        recordingTime // NOVO: Exportar o tempo de gravação
    };
}
