import type { ReactElement } from 'react';
import type { QuoteDocument } from '@zammir/core';

/** La cotización tal como saldrá en el PDF, dibujada desde el MISMO modelo de documento: lo que se ve aquí
 *  y lo que se manda al cliente dicen lo mismo, al centavo [RF-M2-04, S2-12]. */
export function VistaPreviaDeCotizacion({
  documento,
  titulo,
}: {
  readonly documento: QuoteDocument;
  readonly titulo: string;
}): ReactElement {
  const l = documento.labels;
  return (
    <article className="documento" aria-label={titulo}>
      {documento.isDraft ? <p className="documento__borrador">{l.draft}</p> : null}
      <header className="documento__encabezado">
        <div>
          <h3>{documento.business.name}</h3>
          {documento.business.address !== null ? <p>{documento.business.address}</p> : null}
          {documento.business.phone !== null ? <p>{documento.business.phone}</p> : null}
        </div>
        <div className="documento__folio">
          <strong>{l.title.toUpperCase()}</strong>
          <p>{documento.folioLabel}</p>
          {documento.publicCode !== null ? (
            <p>
              {l.publicCode} {documento.publicCode}
            </p>
          ) : null}
        </div>
      </header>

      <p>
        {l.date}: {documento.issuedDate}
        {documento.validUntilDate !== '' ? ` · ${l.validUntil}: ${documento.validUntilDate}` : ''}
      </p>
      <p>
        <strong>
          {l.customer}: {documento.customer.name}
        </strong>
        {' · '}
        {documento.customer.phone}
      </p>
      {documento.siteAddress !== null ? (
        <p>
          {l.site}: {documento.siteAddress}
        </p>
      ) : null}

      <table className="documento__tabla">
        <thead>
          <tr>
            <th>#</th>
            <th>{l.concept}</th>
            <th>{l.quantity}</th>
            <th>{l.unitPrice}</th>
            <th>{l.amount}</th>
          </tr>
        </thead>
        <tbody>
          {documento.lines.map((linea) => (
            <tr key={linea.position}>
              <td>{linea.position}</td>
              <td>
                <strong>{linea.name}</strong>
                <br />
                <small>{linea.detail}</small>
              </td>
              <td>{linea.quantity}</td>
              <td>{linea.unitPrice}</td>
              <td>{linea.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="documento__totales">
        <dt>{l.subtotal}</dt>
        <dd>{documento.subtotal}</dd>
        <dt>{l.tax}</dt>
        <dd>{documento.tax}</dd>
        <dt>
          <strong>{l.total}</strong>
        </dt>
        <dd>
          <strong>{documento.total}</strong>
        </dd>
      </dl>

      <h4>{l.conditions}</h4>
      <ol>
        {documento.conditions.map((condicion) => (
          <li key={condicion}>{condicion}</li>
        ))}
      </ol>
      <p className="documento__firma">{l.signature}</p>
      <p>
        <small>{documento.privacyNotice}</small>
      </p>
    </article>
  );
}
