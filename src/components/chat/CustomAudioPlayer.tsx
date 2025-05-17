// src/components/common/CustomAudioPlayer.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    IoPlaySharp,
    IoPauseSharp,
    IoVolumeMediumSharp,
    IoVolumeMuteSharp,
    IoReloadSharp, // Para o estado de loading
} from 'react-icons/io5';
import Button from '../common/Button'; // Certifique-se que o caminho para seu componente Button está correto

interface CustomAudioPlayerProps {
    src: string;
    fileName: string;
}

const formatTime = (timeInSeconds: number): string => {
    if (isNaN(timeInSeconds) || timeInSeconds === Infinity) {
        return '0:00';
    }
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const CustomAudioPlayer: React.FC<CustomAudioPlayerProps> = ({ src, fileName }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const volumeBarRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(0.75); // Inicia com um volume padrão
    const [isMuted, setIsMuted] = useState(false);
    const [lastVolumeBeforeMute, setLastVolumeBeforeMute] = useState(0.75);
    const [showVolumeControl, setShowVolumeControl] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true); // Começa como true até o áudio carregar

    const handleCanPlay = useCallback(() => {
        setIsLoading(false);
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    }, []);

    const handleWaiting = useCallback(() => {
        setIsLoading(true);
    }, []);

    const handleTimeUpdate = useCallback(() => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    }, []);

    const handleAudioEnded = useCallback(() => {
        setIsPlaying(false);
        // Opcional: voltar para o início automaticamente
        // if (audioRef.current) {
        //     audioRef.current.currentTime = 0;
        // }
    }, []);

    const handleError = useCallback(() => {
        if (audioRef.current && audioRef.current.error) {
            const err = audioRef.current.error;
            let message = "Erro ao carregar áudio.";
            switch (err.code) {
                case MediaError.MEDIA_ERR_ABORTED: message = 'Reprodução abortada.'; break;
                case MediaError.MEDIA_ERR_NETWORK: message = 'Erro de rede.'; break;
                case MediaError.MEDIA_ERR_DECODE: message = 'Erro ao decodificar.'; break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: message = 'Formato não suportado.'; break;
                default: message = 'Erro desconhecido com o áudio.';
            }
            setError(message);
            setIsLoading(false);
            console.error("Audio Error:", message, err);
        }
    }, []);

    useEffect(() => {
        const audio = audioRef.current;
        if (audio) {
            // Configurar ouvintes de evento
            audio.addEventListener('loadedmetadata', handleCanPlay); // Melhor que canplay para pegar duration
            audio.addEventListener('canplay', handleCanPlay);
            audio.addEventListener('waiting', handleWaiting);
            audio.addEventListener('playing', () => setIsLoading(false));
            audio.addEventListener('timeupdate', handleTimeUpdate);
            audio.addEventListener('ended', handleAudioEnded);
            audio.addEventListener('error', handleError);

            // Definir volume inicial e estado de mudo
            audio.volume = isMuted ? 0 : volume;

            // Se o src mudar, recarregar o áudio
            if (audio.currentSrc !== src) {
                setIsLoading(true);
                setError(null);
                audio.load(); // Isso vai disparar 'loadedmetadata' ou 'error'
            }


            return () => {
                audio.removeEventListener('loadedmetadata', handleCanPlay);
                audio.removeEventListener('canplay', handleCanPlay);
                audio.removeEventListener('waiting', handleWaiting);
                audio.removeEventListener('playing', () => setIsLoading(false));
                audio.removeEventListener('timeupdate', handleTimeUpdate);
                audio.removeEventListener('ended', handleAudioEnded);
                audio.removeEventListener('error', handleError);
            };
        }
    }, [src, handleCanPlay, handleWaiting, handleTimeUpdate, handleAudioEnded, handleError]);


    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    const togglePlayPause = () => {
        if (!audioRef.current || error || (isLoading && duration === 0)) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(playError => {
                console.error("Erro ao tentar reproduzir áudio:", playError);
                setError("Não foi possível iniciar a reprodução.");
                setIsLoading(false);
            });
        }
        setIsPlaying(!isPlaying);
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !progressBarRef.current || error || isLoading || duration === 0) return;
        const progressBar = progressBarRef.current;
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const newTime = (clickX / progressBar.offsetWidth) * duration;
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const handleVolumeInteraction = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (!audioRef.current || !volumeBarRef.current || error) return;
        const volumeBar = volumeBarRef.current;
        const rect = volumeBar.getBoundingClientRect();

        let clientX;
        if ('touches' in e) { // TouchEvent
            clientX = e.touches[0].clientX;
        } else { // MouseEvent
            clientX = e.clientX;
        }

        const clickX = clientX - rect.left;
        let newVolume = clickX / volumeBar.offsetWidth;
        newVolume = Math.max(0, Math.min(1, newVolume));

        setVolume(newVolume);
        setIsMuted(newVolume < 0.01); // Considerar mudo se volume for muito baixo
        if (newVolume >= 0.01) setLastVolumeBeforeMute(newVolume);
    };


    const toggleMute = () => {
        if (error) return;
        if (isMuted) {
            // Se estava mudo, restaura para o último volume conhecido ou um padrão
            const newVolume = lastVolumeBeforeMute > 0.01 ? lastVolumeBeforeMute : 0.5;
            setVolume(newVolume);
            setIsMuted(false);
        } else {
            setLastVolumeBeforeMute(volume); // Salva o volume atual
            setVolume(0);
            setIsMuted(true);
        }
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const volumePercent = isMuted ? 0 : volume * 100;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-3 bg-slate-800/80 border border-red-700/50 rounded-lg text-red-400 text-xs w-full">
                <p className="text-center max-w-xs">{error}</p>
            </div>
        );
    }

    return (
        <div className="custom-audio-player bg-slate-800/80 border border-slate-700/70 p-3 rounded-lg shadow-md w-full">
            <audio ref={audioRef} src={src} preload="metadata" className="hidden"></audio>

            <div className="flex items-center space-x-3">
                <Button
                    onClick={togglePlayPause}
                    variant="icon"
                    className="!p-2.5 text-slate-200 hover:text-blue-400 bg-slate-700 hover:bg-slate-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors"
                    aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
                    disabled={isLoading && duration === 0}
                    title={isPlaying ? 'Pausar' : 'Reproduzir'}
                >
                    {isLoading && duration === 0 ? <IoReloadSharp size={18} className="animate-spin" /> : (isPlaying ? <IoPauseSharp size={18} /> : <IoPlaySharp size={18} />)}
                </Button>

                <div className="flex-grow flex items-center space-x-2">
                    <span className="text-xs font-mono text-slate-400 w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
                    <div
                        ref={progressBarRef}
                        className="relative w-full h-2 bg-slate-600 rounded-full cursor-pointer group flex items-center"
                        onClick={handleProgressClick}
                        title="Barra de progresso"
                    >
                        <div
                            className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                        <div className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 bg-white rounded-full shadow border border-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ left: `${progressPercent}%` }}
                        ></div>
                    </div>
                    <span className="text-xs font-mono text-slate-400 w-10 text-left tabular-nums">{formatTime(duration)}</span>
                </div>

                <div className="relative flex items-center"
                    onMouseEnter={() => setShowVolumeControl(true)}
                    onMouseLeave={() => setShowVolumeControl(false)}
                >
                    <Button
                        onClick={toggleMute}
                        variant="icon"
                        className="!p-2 text-slate-300 hover:text-slate-100 focus:outline-none"
                        aria-label={isMuted ? 'Ativar som' : 'Desativar som'}
                        title={isMuted ? 'Ativar som' : 'Desativar som'}
                    >
                        {isMuted || volume < 0.01 ? <IoVolumeMuteSharp size={18} /> : <IoVolumeMediumSharp size={18} />}
                    </Button>
                    {showVolumeControl && (
                        <div
                            className="absolute right-[calc(100%+4px)] top-1/2 -translate-y-1/2 p-2 bg-slate-700 rounded-md shadow-xl w-28 h-8 flex items-center z-10 border border-slate-600"
                        >
                            <div
                                ref={volumeBarRef}
                                className="relative w-full h-1.5 bg-slate-500 rounded-full cursor-pointer group/volume flex items-center"
                                onClick={handleVolumeInteraction}
                                onTouchMove={handleVolumeInteraction} // Para mobile
                                title="Controle de volume"
                            >
                                <div
                                    className="absolute top-0 left-0 h-full bg-blue-400 rounded-full"
                                    style={{ width: `${volumePercent}%` }}
                                ></div>
                                <div className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 bg-white rounded-full shadow border border-slate-400 opacity-0 group-hover/volume:opacity-100 transition-opacity"
                                    style={{ left: `${volumePercent}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2.5 truncate text-center px-1">
                {fileName}
            </p>
        </div>
    );
};

export default CustomAudioPlayer;
