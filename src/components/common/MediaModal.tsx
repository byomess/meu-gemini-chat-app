import { Transition, Dialog } from "@headlessui/react";
import React, { Fragment } from "react";
import { IoCloseOutline } from "react-icons/io5";
import Button from "./Button";

interface MediaModalProps {
    isOpen: boolean;
    onClose: () => void;
    mediaUrl?: string;
    mediaName?: string;
    mediaType?: string;
}

export const MediaModal: React.FC<MediaModalProps> = ({ isOpen, onClose, mediaUrl, mediaName, mediaType }) => {
    if (!mediaUrl) return null;


    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[150]" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-lg bg-transparent p-0 text-left align-middle shadow-xl transition-all">
                                {mediaType?.startsWith('image/') && (
                                    <img
                                        src={mediaUrl}
                                        alt={mediaName || 'Imagem Ampliada'}
                                        className="max-h-[90vh] max-w-full mx-auto object-contain rounded-md"
                                    />
                                )}
                                {mediaType?.startsWith('video/') && (
                                    <video
                                        src={mediaUrl}
                                        controls
                                        autoPlay
                                        className="max-h-[90vh] max-w-full mx-auto object-contain rounded-md"
                                        title={mediaName || 'Vídeo Ampliado'}
                                    />
                                )}
                                <Button
                                    variant="icon"
                                    onClick={onClose}
                                    className="!absolute top-2 right-2 !p-2.5 text-white bg-black/50 hover:!bg-black/70 rounded-full z-10"
                                    title="Fechar mídia"
                                >
                                    <IoCloseOutline size={24} />
                                </Button>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};