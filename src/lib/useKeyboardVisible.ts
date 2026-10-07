import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** Taller than browser toolbars collapsing/expanding, shorter than any on-screen keyboard. */
const WEB_KEYBOARD_MIN = 150;

function webKeyboardOpen() {
  if (typeof window === 'undefined') return false;
  const vv = window.visualViewport;
  if (vv && window.innerHeight - vv.height * vv.scale > WEB_KEYBOARD_MIN) return true;
  // Browsers that resize the whole page for the keyboard leave no viewport gap: a focused text field on a
  // touch screen is the remaining hint.
  const el = document.activeElement as HTMLElement | null;
  const typing = !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range|color|file)$/.test((el as HTMLInputElement).type)) || el.isContentEditable);
  return typing && window.matchMedia?.('(pointer: coarse)').matches === true;
}

/**
 * Whether the on-screen keyboard is open. Native uses `Keyboard` events; the web has none, so it watches the
 * visual viewport (mobile browsers shrink it for the keyboard) and text-field focus on touch screens.
 */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(() => (Platform.OS === 'web' ? webKeyboardOpen() : Keyboard.isVisible()));

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      // focusout fires before the next element takes focus.
      const update = () => setTimeout(() => setVisible(webKeyboardOpen()), 0);
      const vv = window.visualViewport;
      vv?.addEventListener('resize', update);
      window.addEventListener('resize', update);
      window.addEventListener('focusin', update);
      window.addEventListener('focusout', update);
      return () => {
        vv?.removeEventListener('resize', update);
        window.removeEventListener('resize', update);
        window.removeEventListener('focusin', update);
        window.removeEventListener('focusout', update);
      };
    }
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
