import { documentRendererContract } from '@zammir/core/testing';

import { fakeDocumentRenderer } from './fake-document-renderer';

documentRendererContract('falso (texto)', () => ({
  renderer: fakeDocumentRenderer(),
  textOf: (bytes) => Promise.resolve(new TextDecoder().decode(bytes)),
  pagesOf: (bytes) => Promise.resolve(new TextDecoder().decode(bytes).split('\f').length),
}));
