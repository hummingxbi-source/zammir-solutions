import { textos } from '../../shared/i18n/textos';
import { iconoDeSeccion, type NombreDeIcono } from '../../shared/ui/Icono';
import { seccionesVisibles, type Interruptor } from '../secciones';
import type { LadoDeGlobo } from './posicion';

const t = textos.recorrido;
const TEXTOS_DE_SECCION: Readonly<Record<string, string>> = t.secciones;

/** Un paso del recorrido guiado [RF-UX-04]. */
export interface PasoDelRecorrido {
  readonly id: string;
  /** Pantalla a la que se va antes de mostrar el paso; `null` si se queda donde está. */
  readonly ruta: string | null;
  /** Valores de `data-recorrido` que se buscan en orden; se enfoca el primero que se vea. Si no hay
   *  ninguno visible (o la lista está vacía), el globo va al centro y explica igual. */
  readonly objetivos: readonly string[];
  /** Lado preferido del globo junto al elemento. */
  readonly lado: LadoDeGlobo;
  readonly icono: NombreDeIcono;
  /** Rótulo pequeño sobre el título (por ejemplo, "Flujo de trabajo · 2 de 5"). */
  readonly rotulo: string | null;
  readonly titulo: string;
  readonly texto: string;
}

/** Los pasos del recorrido en orden: bienvenida, formas de entrar, inicio, cada sección del flujo de trabajo y
 *  de administración (solo las que se muestran con los interruptores actuales), el estado de conexión, quién
 *  usa la tablet, la cuenta de administrador, la ayuda y el cierre. */
export function pasosDelRecorrido(
  interruptores: ReadonlySet<Interruptor>,
): readonly PasoDelRecorrido[] {
  const principales = seccionesVisibles('principal', interruptores);
  const secundarias = seccionesVisibles('secundaria', interruptores);

  const deSeccion = principales
    .map((seccion, indice): PasoDelRecorrido => ({
      id: `seccion-${seccion.id}`,
      ruta: seccion.ruta,
      objetivos: [`nav-${seccion.id}`],
      lado: 'derecha',
      icono: iconoDeSeccion(seccion.id),
      rotulo: t.flujo(indice + 1, principales.length),
      titulo: seccion.texto,
      texto: TEXTOS_DE_SECCION[seccion.id] ?? '',
    }))
    .concat(
      secundarias.map((seccion): PasoDelRecorrido => ({
        id: `seccion-${seccion.id}`,
        ruta: seccion.ruta,
        objetivos: [`nav-${seccion.id}`],
        lado: 'derecha',
        icono: iconoDeSeccion(seccion.id),
        rotulo: t.administracion,
        titulo: seccion.texto,
        texto: TEXTOS_DE_SECCION[seccion.id] ?? '',
      })),
    );

  return [
    {
      id: 'bienvenida',
      ruta: '/',
      objetivos: [],
      lado: 'abajo',
      icono: 'brujula',
      rotulo: null,
      ...t.bienvenida,
    },
    {
      id: 'formas',
      ruta: '/',
      objetivos: ['formas-de-entrar'],
      lado: 'abajo',
      icono: 'usuarios',
      rotulo: null,
      ...t.formas,
    },
    {
      id: 'inicio',
      ruta: '/',
      objetivos: ['nav-inicio'],
      lado: 'derecha',
      icono: 'inicio',
      rotulo: null,
      ...t.inicio,
    },
    ...deSeccion,
    {
      id: 'conexion',
      ruta: '/',
      objetivos: ['conexion'],
      lado: 'abajo',
      icono: 'nube',
      rotulo: null,
      ...t.conexion,
    },
    {
      id: 'persona',
      ruta: null,
      objetivos: ['persona-activa'],
      lado: 'abajo',
      icono: 'usuarios',
      rotulo: null,
      ...t.persona,
    },
    {
      id: 'cuenta',
      ruta: null,
      objetivos: ['cuenta'],
      lado: 'abajo',
      icono: 'configuracion',
      rotulo: null,
      ...t.cuenta,
    },
    {
      id: 'por-donde',
      ruta: null,
      objetivos: ['por-donde-empiezo'],
      lado: 'arriba',
      icono: 'ayuda',
      rotulo: null,
      ...t.porDonde,
    },
    {
      id: 'repetir',
      ruta: null,
      objetivos: ['boton-recorrido'],
      lado: 'derecha',
      icono: 'brujula',
      rotulo: null,
      ...t.repetir,
    },
    {
      id: 'final',
      ruta: '/',
      objetivos: [],
      lado: 'abajo',
      icono: 'verificar',
      rotulo: null,
      ...t.final,
    },
  ];
}
