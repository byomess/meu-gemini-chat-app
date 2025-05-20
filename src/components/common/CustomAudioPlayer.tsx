// src/components/common/CustomAudioPlayer.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    IoPlaySharp,
    IoPauseSharp,
    IoVolumeMediumSharp,
    IoVolumeMuteSharp,
    IoReloadSharp, // Para o estado de loading
} from 'react-icons/io5';
import Button from './Button'; // Certifique-se que o caminho para seu componente Button está correto

interface CustomAudioPlayerProps {
    src: string;
    fileName: string;
}

const formatTime = (timeInSeconds: number): string => {
    // Garante que !isFinite cubra NaN e Infinity.
    if (!isFinite(timeInSeconds) || timeInSeconds < 0) {
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
    const [duration, setDuration] = useState(0); // Inicialmente 0
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(0.75);
    const [isMuted, setIsMuted] = useState(false);
    const [lastVolumeBeforeMute, setLastVolumeBeforeMute] = useState(0.75);
    const [showVolumeControl, setShowVolumeControl] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true); // Começa true

    // Handler de erro para o evento 'error' do elemento <audio>
    const handleAudioElementError = useCallback(() => {
        const audio = audioRef.current;
        if (audio && audio.error) {
            const err = audio.error;
            let message = "Erro ao carregar áudio.";
            switch (err.code) {
                case MediaError.MEDIA_ERR_ABORTED: message = 'Reprodução abortada pelo usuário ou script.'; break;
                case MediaError.MEDIA_ERR_NETWORK: message = 'Erro de rede ao buscar o áudio.'; break;
                case MediaError.MEDIA_ERR_DECODE: message = 'Erro ao decodificar o áudio.'; break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: message = 'Formato de áudio não suportado ou fonte inválida.'; break;
                default: message = 'Ocorreu um erro desconhecido com o áudio.';
            }
            setError(message);
            setIsLoading(false);
            console.error("Audio Element Error:", message, err);
        }
    }, []);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        // Resetar estados sempre que 'src' mudar ou na montagem inicial
        setIsLoading(true);
        setError(null);
        setDuration(0); // Crucial: garante que "0:00" seja mostrado enquanto carrega
        setCurrentTime(0);
        setIsPlaying(false); // Para a reprodução se estava tocando um áudio anterior

        if (!src) {
            setIsLoading(false);
            // setError("Nenhuma fonte de áudio fornecida."); // Opcional: informar se o src é vazio
            return; // Não configura listeners se não há src
        }

        // O atributo 'src' do <audio> é atualizado pelo React devido ao prop 'src'.
        // Chamamos .load() para que o elemento processe o novo 'src'.
        audio.load();

        const onMetadataLoaded = () => {
            if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
                setDuration(audio.duration);
            } else {
                // Se a duração for 0, NaN, ou Infinity, mantenha como 0.
                // Isso pode acontecer com streams ou arquivos problemáticos.
                setDuration(0);
            }
            // Não alterar isLoading aqui; esperar por 'canplay' ou 'playing'.
        };

        const onCanPlay = () => {
            setIsLoading(false); // O áudio tem dados suficientes para começar a tocar.
            // Fallback caso 'loadedmetadata' não tenha pego a duração (improvável mas seguro)
            if (audio.duration && isFinite(audio.duration) && audio.duration > 0 && duration === 0) {
                setDuration(audio.duration);
            }
        };
        
        const onWaiting = () => setIsLoading(true); // Entrou em buffer
        const onPlaying = () => {
            setIsLoading(false); // Saiu do buffer ou começou a tocar
            setIsPlaying(true);
        };
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => {
            if (isFinite(audio.currentTime)) {
                setCurrentTime(audio.currentTime);
            }
        };
        const onAudioEnded = () => {
            setIsPlaying(false);
            // Opcional: voltar para o início ou manter no final.
            // Voltando para o início:
            if (audioRef.current) audioRef.current.currentTime = 0;
            setCurrentTime(0);
        };

        audio.addEventListener('loadedmetadata', onMetadataLoaded);
        audio.addEventListener('canplay', onCanPlay);
        audio.addEventListener('waiting', onWaiting);
        audio.addEventListener('playing', onPlaying);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('ended', onAudioEnded);
        audio.addEventListener('error', handleAudioElementError);

        return () => {
            audio.removeEventListener('loadedmetadata', onMetadataLoaded);
            audio.removeEventListener('canplay', onCanPlay);
            audio.removeEventListener('waiting', onWaiting);
            audio.removeEventListener('playing', onPlaying);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('ended', onAudioEnded);
            audio.removeEventListener('error', handleAudioElementError);
        };
    }, [src, handleAudioElementError]); // src é a dependência principal. handleAudioElementError é useCallback.

    // Efeito para aplicar volume e mute (separado para não re-rodar o useEffect principal desnecessariamente)
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    const togglePlayPause = () => {
        if (!audioRef.current || error) return;
        // Permite tentar tocar mesmo se isLoading=true mas duration já existe (metadados carregados)
        if (isLoading && (!duration || audioRef.current.readyState < 2)) return; // readyState < HAVE_CURRENT_DATA

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(playError => {
                console.error("Erro ao tentar reproduzir áudio (play API):", playError);
                setError("Não foi possível iniciar a reprodução.");
                setIsLoading(false); // Garante que não fique em loading eterno
                setIsPlaying(false); // Corrige o estado se o play falhou
            });
        }
        // O estado isPlaying será atualizado pelos eventos 'playing'/'pause',
        // mas para feedback imediato do ícone, podemos setar aqui:
        // Esta linha foi removida no seu código original; re-adicionando para UX típico.
        // Se play() falhar, o catch acima corrige.
        // Se for manter estritamente pelos eventos, remova a linha abaixo.
        // setIsPlaying(!isPlaying); // Comentado para seguir a lógica de depender dos eventos. O catch já trata a falha.
                                   // No seu código original, você tinha setIsPlaying(!isPlaying) aqui.
                                   // Se restaurar, certifique-se que o catch do play() reseta para false em caso de erro.
                                   // Como os eventos 'playing' e 'pause' já cuidam de setIsPlaying,
                                   // não é estritamente necessário aqui, e pode até causar um flicker se o evento demorar.
                                   // O seu original era: `setIsPlaying(!isPlaying);` no final.
                                   // Para evitar o problema de estado otimista vs. real, vou deixar os eventos cuidarem.
                                   // O `catch` do `play()` já faz `setIsPlaying(false)` em caso de erro.
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !progressBarRef.current || error || isLoading || duration === 0 || !isFinite(duration)) return;
        const progressBar = progressBarRef.current;
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const newTime = (clickX / progressBar.offsetWidth) * duration;
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime); // Atualiza UI imediatamente
    };

    const handleVolumeInteraction = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (!audioRef.current || !volumeBarRef.current || error) return;
        const volumeBar = volumeBarRef.current;
        const rect = volumeBar.getBoundingClientRect();

        let clientX;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
        } else {
            clientX = e.clientX;
        }

        const clickX = clientX - rect.left;
        let newVolume = clickX / volumeBar.offsetWidth;
        newVolume = Math.max(0, Math.min(1, newVolume)); // Clamp 0-1

        setVolume(newVolume);
        setIsMuted(newVolume < 0.01);
        if (newVolume >= 0.01) setLastVolumeBeforeMute(newVolume);
    };

    const toggleMute = () => {
        if (error) return;
        if (isMuted) {
            const newVolume = lastVolumeBeforeMute > 0.01 ? lastVolumeBeforeMute : 0.5;
            setVolume(newVolume);
            setIsMuted(false);
        } else {
            setLastVolumeBeforeMute(volume);
            setVolume(0);
            setIsMuted(true);
        }
    };

    const progressPercent = (duration > 0 && isFinite(duration)) ? (currentTime / duration) * 100 : 0;
    const volumePercent = isMuted ? 0 : volume * 100;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-3 bg-slate-800/80 border border-red-700/50 rounded-lg text-red-400 text-xs w-full">
                <p className="text-center max-w-xs">{error}</p>
            </div>
        );
    }

    // Lógica para o ícone do botão de play/pause
    let playButtonIcon;
    // Se está carregando E (não tem duração OU o áudio não tem metadados ainda)
    if (isLoading && (!duration || (audioRef.current && audioRef.current.readyState < audioRef.current.HAVE_METADATA))) {
        playButtonIcon = <IoReloadSharp size={18} className="animate-spin" />;
    } else if (isPlaying) {
        playButtonIcon = <IoPauseSharp size={18} />;
    } else {
        playButtonIcon = <IoPlaySharp size={18} />;
    }

    return (
        <div className="bg-slate-800/80 border border-slate-700/70 p-3 rounded-lg shadow-md">
            {/* preload="metadata" é importante para 'loadedmetadata' disparar cedo */}
            <audio ref={audioRef} src={src} preload="metadata" className="hidden"></audio>

            <div className="flex items-center space-x-3">
                <Button
                    onClick={togglePlayPause}
                    variant="icon"
                    className="!p-2.5 text-slate-200 hover:text-blue-400 bg-slate-700 hover:bg-slate-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors"
                    aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
                    // Desabilita se não há fonte, ou se está carregando e não tem nem metadados ainda.
                    disabled={!src || (isLoading && (!duration || (audioRef.current?.readyState ?? 0) < (audioRef.current?.HAVE_METADATA ?? 0)))}
                    title={isPlaying ? 'Pausar' : 'Reproduzir'}
                >
                    {playButtonIcon}
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
                    {/* Mostra a duração real, ou 0:00 se ainda não carregou / erro / stream sem fim */}
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
                                onTouchMove={handleVolumeInteraction}
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