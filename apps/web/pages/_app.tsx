import type { AppProps } from 'next/app'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <a href="#main" className="skip-link">К содержанию</a>
      <Component {...pageProps} />
    </>
  )
}
