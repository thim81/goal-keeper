import { useRef, useState } from "react";

export type SubmitAction<Args extends unknown[] = []> = (
  ...args: Args
) => boolean | void | Promise<boolean | void>;

export function useSubmitAction<Args extends unknown[]>(
  action: SubmitAction<Args>,
  onSuccess?: (...args: Args) => void,
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);

  const submit = async (...args: Args): Promise<boolean> => {
    if (submitting.current) return false;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      const result = action(...args);
      const confirmed = typeof result === "object" ? await result : result;
      if (confirmed === false) return false;
      onSuccess?.(...args);
      return true;
    } catch {
      // The action reports its error; leave the form and entered values intact.
      return false;
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return { submit, isSubmitting };
}
