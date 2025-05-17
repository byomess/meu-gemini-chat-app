// src/components/common/Button.tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'icon'; // Adicionada a variante 'icon'
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className, ...props }) => {
  // Classes base aplicadas a todos os botões
  const baseStyles = 
    'inline-flex items-center justify-center ' + // Para alinhar ícones e texto se ambos estiverem presentes
    'font-medium focus:outline-none ' + // 'font-semibold' foi movido para variantes de texto
    'focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ' + // Offset para melhor visibilidade do anel
    'disabled:opacity-60 disabled:pointer-events-none ' + // Estilos para desabilitado
    'transition-all duration-150 ease-in-out'; // Transições suaves

  // Estilos específicos para cada variante
  const variantStyles = {
    primary: 
      'px-4 py-2 rounded-md text-sm ' + // Padding e arredondamento para botões de texto
      'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:ring-blue-500 ' +
      'shadow-sm hover:shadow-md',
    secondary: 
      'px-4 py-2 rounded-md text-sm ' +
      'bg-slate-600 text-slate-100 hover:bg-slate-700 active:bg-slate-800 focus:ring-slate-500 ' +
      'shadow-sm hover:shadow-md',
    danger: 
      'px-4 py-2 rounded-md text-sm ' +
      'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500 ' +
      'shadow-sm hover:shadow-md',
    icon: 
      'p-2 rounded-full ' + // Padding menor e totalmente arredondado para botões de ícone
      'text-slate-300 hover:text-slate-100 ' + // Cor de texto padrão para ícones
      'hover:bg-slate-700/70 active:bg-slate-600 focus:ring-blue-500', // Foco consistente ou pode ser 'focus:ring-slate-500'
  };

  return (
    <button
      type="button" // Botões geralmente devem ter um type explícito
      className={`${baseStyles} ${variantStyles[variant]} ${className || ''}`} // className é aplicado por último para permitir sobrescrita
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;