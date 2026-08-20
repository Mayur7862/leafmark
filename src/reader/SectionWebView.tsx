import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

type Props = {
  html: string;
  fragment?: string | null;
  onInternalLink?: (href: string) => void;
};

export function SectionWebView({ html, fragment, onInternalLink }: Props) {
  const injected = useMemo(() => {
    const frag = fragment ? JSON.stringify(fragment) : 'null';
    return `
      (function() {
        document.addEventListener('click', function(event) {
          var target = event.target;
          while (target && target.tagName !== 'A') {
            target = target.parentElement;
          }
          if (!target) return;
          var href = target.getAttribute('href');
          if (!href) return;
          if (/^(https?:|mailto:|tel:)/i.test(href)) return;
          event.preventDefault();
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'link', href: href }));
        }, true);

        var fragment = ${frag};
        if (fragment) {
          setTimeout(function() {
            var el = document.getElementById(fragment) || document.getElementsByName(fragment)[0];
            if (el && el.scrollIntoView) el.scrollIntoView();
          }, 40);
        }
        true;
      })();
    `;
  }, [fragment]);

  return (
    <WebView
      style={styles.web}
      originWhitelist={['*']}
      source={{ html }}
      setSupportMultipleWindows={false}
      nestedScrollEnabled
      injectedJavaScript={injected}
      onMessage={(event) => {
        try {
          const payload = JSON.parse(event.nativeEvent.data) as { type?: string; href?: string };
          if (payload.type === 'link' && payload.href && onInternalLink) {
            onInternalLink(payload.href);
          }
        } catch {
          // ignore malformed messages
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  web: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
