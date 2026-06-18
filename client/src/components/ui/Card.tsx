import React from 'react';
import { clsx } from 'clsx';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export function Card({
  title,
  subtitle,
  children,
  footer,
  className,
  actions,
}: CardProps): React.ReactElement {
  return (
    <div className={clsx('card', className)}>
      {(title || subtitle || actions) && (
        <div className="card-header flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          </div>
          {actions && <div className="ml-4 flex-shrink-0">{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}
