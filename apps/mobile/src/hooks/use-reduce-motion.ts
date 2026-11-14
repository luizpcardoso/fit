import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Follows the system "reduzir movimento" setting, so decorative animations can be skipped. */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduce(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduce;
}
