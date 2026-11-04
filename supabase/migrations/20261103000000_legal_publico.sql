-- S4-11 y S4-12 · Aviso de privacidad y términos públicos, y aviso con proveedores y canal de derechos
-- [RF-M9-01, RF-M9-02, RF-M9-04, RF-M9-05, RNF-17, ADR-0029].
--
-- El aviso y los términos que ya rigen son públicos por naturaleza: cualquier cliente debe poder leerlos
-- desde el enlace de su cotización o comprobante, sin entrar al sistema. Por eso los anónimos pueden
-- LEER las versiones vigentes (nunca las de fecha futura) y nada más: no publican, no modifican, no borran.
-- El canal para ejercer derechos sale de los datos del negocio con una función que expone solo esos tres
-- datos (nombre, WhatsApp y domicilio), no la tabla de ajustes.

grant select on public.legal_documents to anon;

create policy "cualquiera lee los documentos legales que ya rigen"
  on public.legal_documents
  for select
  to anon
  using (effective_from <= now());

create or replace function public.public_business_contact()
returns table (name text, phone text, address text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select nullif(value #>> '{}', '') from public.business_settings where key = 'business_name'),
    (select nullif(value #>> '{}', '') from public.business_settings where key = 'business_phone'),
    (select nullif(value #>> '{}', '') from public.business_settings where key = 'business_address')
$$;

comment on function public.public_business_contact() is
  'Nombre, WhatsApp y domicilio del negocio para el aviso de privacidad público. Nulos mientras no se definan (PD-11).';

revoke all on function public.public_business_contact() from public;
grant execute on function public.public_business_contact() to anon, authenticated;

-- Versión 2 del borrador del aviso (PD-12): declara a los proveedores técnicos [RNF-17] y la transferencia
-- de los datos fiscales al PAC [RF-M9-05], y dice dónde ejercer los derechos [RF-M9-04]. Sigue siendo un
-- borrador genérico, sin datos reales: el texto final lo valida ZAMMIR con su asesor.
insert into public.legal_documents (type, effective_from, body) values (
  'PRIVACY_NOTICE',
  '2026-11-03T00:00:00Z',
  E'BORRADOR — pendiente de revisión por el asesor de ZAMMIR (PD-12)\n\n'
  'AVISO DE PRIVACIDAD SIMPLIFICADO\n\n'
  'Responsable: ZAMMIR, Soluciones en Vidrio y Aluminio, [domicilio del negocio por definir].\n\n'
  'Datos que recabamos: tu nombre, tu teléfono o WhatsApp y, si lo proporcionas, tu correo, la dirección de '
  'la obra y, solo cuando pides factura, tus datos fiscales (RFC, razón social, código postal, régimen y uso '
  'del CFDI).\n\n'
  'Para qué los usamos: elaborar cotizaciones y órdenes de trabajo, contactarte sobre tu pedido, cobrar, '
  'dar garantía y emitir tu factura.\n\n'
  'Con quién los compartimos: no los vendemos. Para operar el sistema usamos proveedores técnicos que '
  'almacenan o procesan los datos por cuenta nuestra: Vercel (alojamiento de la aplicación), Supabase '
  '(base de datos y acceso) y Cloudflare (protección y conectividad). Cuando pides factura, tus datos '
  'fiscales también se transfieren a nuestro proveedor autorizado de certificación (PAC), que los necesita '
  'para timbrarla; sin esa transferencia no es posible emitir la factura.\n\n'
  'Tus derechos: puedes pedir acceso, corrección, cancelación u oposición al uso de tus datos '
  'escribiéndonos por WhatsApp o correo al canal de contacto que aparece al pie de esta página y en tus '
  'documentos. También puedes pedir que anonimicemos tus datos personales; conservaremos solo los '
  'registros contables y fiscales que la ley nos obliga a guardar.'
);
