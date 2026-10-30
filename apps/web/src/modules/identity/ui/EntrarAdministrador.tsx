import { useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import type { AuthErrorCode } from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo } from '../../../shared/ui/Campo';
import { useSesionAdmin } from './SesionAdmin';

/** Entrada de administradores con correo y contraseña. */
export function EntrarAdministrador(): ReactElement {
  const { entrar } = useSesionAdmin();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<AuthErrorCode | null>(null);

  async function enviar(evento: SyntheticEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    const resultado = await entrar(correo, contrasena);
    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error.code);
      setContrasena('');
    }
  }

  const t = textos.entrada;
  return (
    <section className="anima-entrada">
      <h1>{t.titulo}</h1>
      <p>{t.soloAdministradores}</p>
      <form
        noValidate
        onSubmit={(evento) => {
          void enviar(evento);
        }}
        className="formulario"
      >
        <Campo
          etiqueta={t.correo}
          type="email"
          autoComplete="username"
          value={correo}
          onChange={(evento) => {
            setCorreo(evento.target.value);
          }}
        />
        <Campo
          etiqueta={t.contrasena}
          type="password"
          autoComplete="current-password"
          value={contrasena}
          onChange={(evento) => {
            setContrasena(evento.target.value);
          }}
        />
        <Boton type="submit" disabled={enviando}>
          {enviando ? t.entrando : t.boton}
        </Boton>
      </form>
      {error === null ? null : (
        <Aviso tipo="error" queHacer={t.errores[error].queHacer}>
          {t.errores[error].mensaje}
        </Aviso>
      )}
    </section>
  );
}
