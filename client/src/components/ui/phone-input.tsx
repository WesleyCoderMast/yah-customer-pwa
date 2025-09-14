import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PhoneInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  countryCode?: string;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, countryCode = "+1", value, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let phoneValue = e.target.value.replace(/\D/g, '');
      
      // Format as (XXX) XXX-XXXX
      if (phoneValue.length >= 6) {
        phoneValue = `(${phoneValue.slice(0, 3)}) ${phoneValue.slice(3, 6)}-${phoneValue.slice(6, 10)}`;
      } else if (phoneValue.length >= 3) {
        phoneValue = `(${phoneValue.slice(0, 3)}) ${phoneValue.slice(3)}`;
      }
      
      // Update the input value
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: phoneValue
        }
      } as React.ChangeEvent<HTMLInputElement>;
      
      onChange?.(syntheticEvent);
    };

    return (
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-400 z-10">
          {countryCode}
        </div>
        <Input
          {...props}
          ref={ref}
          value={value}
          onChange={handleChange}
          className={cn("pl-12", className)}
          placeholder="(555) 123-4567"
          maxLength={14}
        />
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
