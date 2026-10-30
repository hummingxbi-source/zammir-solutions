import type { ReactElement } from 'react';

import { textos } from './shared/i18n/textos';

export function App(): ReactElement {
  return <main>{textos.app.nombre}</main>;
}
