import { Eye, EyeOff } from 'lucide-react';

interface SecretInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder: string;
  visible: boolean;
  onToggleVisibility: () => void;
  showLabel: string;
  hideLabel: string;
}

export function SecretInput({
  value,
  onChange,
  onBlur,
  placeholder,
  visible,
  onToggleVisibility,
  showLabel,
  hideLabel,
}: SecretInputProps) {
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full px-4 py-3 pr-12 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <button
        type="button"
        onClick={onToggleVisibility}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground"
        aria-label={visible ? hideLabel : showLabel}
        title={visible ? hideLabel : showLabel}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
