import { Overlay } from './overlay/Overlay'
import { MainWindow } from './main-window/MainWindow'

export default function App(): React.JSX.Element {
  const route = window.location.hash.replace('#', '')
  return route === 'overlay' ? <Overlay /> : <MainWindow />
}
