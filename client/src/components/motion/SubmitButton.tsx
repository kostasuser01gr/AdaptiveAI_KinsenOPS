import { motion } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import { SuccessCheck } from './SuccessCheck';
import { Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface SubmitButtonProps {
  children: React.ReactNode;
  isPending?: boolean;
  isSuccess?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * Form submit button with loading spinner and brief success check.
 * Shows SuccessCheck for 1.5s after isSuccess turns true.
 */
export function SubmitButton({
  children,
  isPending,
  isSuccess,
  className,
  type = 'submit',
  disabled,
  onClick,
  variant = 'default',
  size = 'default',
}: SubmitButtonProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (isSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isSuccess]);

  return (
    <Button
      type={type}
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || isPending}
      onClick={onClick}
    >
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : showSuccess ? (
        <SuccessCheck show className="mr-2 h-5 w-5" />
      ) : null}
      {children}
    </Button>
  );
}
