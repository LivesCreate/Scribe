import { Overlay } from './overlay/Overlay'
import { MainWindow } from './main-window/MainWindow'
import { DebugApp } from './debug/DebugApp'

export default function App(): React.JSX.Element {
  const route = window.location.hash.replace('#', '')
  if (route === 'overlay') return <Overlay />
  if (route === 'debug') return <DebugApp />
  return <MainWindow />
}
