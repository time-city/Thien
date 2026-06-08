import React, { useState, useEffect } from "react";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string;
  onChange: (value: number) => void;
}

export function CurrencyInput({ value, onChange, className, ...props }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState<string>("");

  useEffect(() => {
    if (value === "" || value === null || value === undefined) {
      setDisplayValue("");
    } else if (Number(value) === 0 && displayValue === "") {
      // allow empty display for 0 if it was empty, or just format 0
      setDisplayValue("0");
    } else {
      setDisplayValue(Number(value).toLocaleString("vi-VN"));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    
    if (rawValue === "") {
      setDisplayValue("");
      onChange(0);
    } else {
      const numValue = parseInt(rawValue, 10);
      setDisplayValue(numValue.toLocaleString("vi-VN"));
      onChange(numValue);
    }
  };

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      className={className}
    />
  );
}
