import { useEffect, useState } from 'react';
import { Keyframe, LinearTransition } from 'react-native-reanimated';

// זום עדין בלבד: בלי שקיפות ובלי תזוזה.
export const softEnter = new Keyframe({
  0: { transform: [{ scale: 0.95 }] },
  100: { transform: [{ scale: 1 }] },
}).duration(180);

export const softExit = new Keyframe({
  0: { transform: [{ scale: 1 }] },
  100: { transform: [{ scale: 0.95 }] },
}).duration(150);

export const softLayout = LinearTransition.duration(180);

export interface ListMotion {
  entering: typeof softEnter | undefined;
  exiting: typeof softExit;
  layout: typeof softLayout;
}

/**
 * אנימציית כניסה רק לפריטים שנוספים אחרי הטעינה הראשונית של הרשימה
 * (בטעינה הראשונית כל הפריטים מופיעים בלי אנימציה).
 */
export function useListMotion(loaded: boolean): ListMotion {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => setReady(true), 400);
    return () => clearTimeout(t);
  }, [loaded]);
  return { entering: ready ? softEnter : undefined, exiting: softExit, layout: softLayout };
}
