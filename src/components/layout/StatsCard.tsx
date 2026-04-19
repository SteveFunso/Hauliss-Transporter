import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface StatsCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  className?: string;
  formatAsCurrency?: boolean;
  delay?: number;
}

export function StatsCard({
  title,
  value,
  prefix = '',
  suffix = '',
  change,
  changeType = 'neutral',
  icon,
  className,
  formatAsCurrency = false,
  delay = 0
}: StatsCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const timeout = setTimeout(() => {
      const duration = 1500;
      const startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(easeOut * value);
        
        setDisplayValue(currentValue);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    }, delay);

    return () => clearTimeout(timeout);
  }, [isVisible, value, delay]);

  const formatValue = (val: number) => {
    if (formatAsCurrency) {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(val);
    }
    return val.toLocaleString();
  };

  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return 'text-emerald-600 bg-emerald-50';
      case 'negative':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getChangeIcon = () => {
    if (!change) return null;
    if (changeType === 'positive') {
      return (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    );
  };

  return (
    <Card 
      ref={cardRef}
      className={cn(
        'relative p-6 bg-card border-0 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden',
        'hover:-translate-y-1',
        className
      )}
    >
      {/* Background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#F97316]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {title}
            </p>
            <div className="flex items-baseline gap-1">
              {prefix && <span className="text-lg text-muted-foreground">{prefix}</span>}
              <span className="font-display font-bold text-3xl text-foreground">
                {formatValue(displayValue)}
              </span>
              {suffix && <span className="text-lg text-muted-foreground">{suffix}</span>}
            </div>
            
            {change !== undefined && (
              <div className={cn('inline-flex items-center gap-1 mt-3 px-2 py-1 rounded-full text-xs font-medium', getChangeColor())}>
                {getChangeIcon()}
                <span>{Math.abs(change)}%</span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            )}
          </div>
          
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300',
            'bg-[#F97316]/10 text-[#F97316]',
            'group-hover:bg-[#F97316] group-hover:text-white group-hover:scale-110'
          )}>
            {icon}
          </div>
        </div>
      </div>
    </Card>
  );
}
