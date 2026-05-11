export type LeadSource = 'lp_sprout' | 'lp_community' | 'site_spark' | 'indicacao' | 'rd_pipe';

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  lp_sprout:    'LP Sprout (Framer)',
  lp_community: 'LP Community (Framer)',
  site_spark:   'Site Spark (RD nativo)',
  indicacao:    'Indicação Interna',
  rd_pipe:      'RD → Pipedrive',
};

export const WORKFLOW_ID_MAP: Record<string, LeadSource[]> = {
  'J2rdIrv7C7gILmpk': ['lp_sprout', 'lp_community'],
  'o5PuDzn2XkTsOgpn': ['site_spark'],
  'VVdWQERBqJsPxeDo': ['rd_pipe', 'site_spark'],
  'iCSEmoah1GxnsprH': ['indicacao'],
};

export const REQUIRED_FIELDS: Record<LeadSource, string[]> = {
  lp_sprout: [
    'nome', 'email', 'telefone', 'empresa',
    'voce_e', 'o_que_busca', 'frequencia_campanhas',
    'url', 'utm_source', 'utm_medium', 'utm_campaign',
  ],
  lp_community: [
    'nome', 'email', 'telefone', 'empresa',
    'cargo', 'tamanho_da_empresa', 'frequencia_campanhas',
    'url', 'utm_source', 'utm_medium', 'utm_campaign',
  ],
  site_spark: [
    'nome', 'email', 'telefone', 'empresa',
    'voce_e', 'frequencia', 'budget', 'o_que_busca',
    'conversion_url', 'conversion_identifier',
    // UTMs NÃO são validados no site_spark (form RD nativo não captura)
  ],
  indicacao: [
    'sparker_nome', 'sparker_email',
    'indicado_nome', 'indicado_email', 'indicado_telefone',
    'indicado_empresa', 'produto_indicado',
    'url', 'utm_source', 'utm_medium', 'utm_campaign',
  ],
  rd_pipe: [
    'nome', 'email', 'tags', 'rota_definida',
    'destino_pipeline_id', 'destino_stage_id', 'destino_owner_id',
    'pipedrive_person_id', 'pipedrive_deal_id', 'label',
  ],
};

export function validateLeadFields(
  payload: Record<string, any>,
  source: LeadSource,
): string[] {
  const required = REQUIRED_FIELDS[source];
  return required.filter(field => {
    const val = payload[field];
    return val === undefined || val === null || val === '' || val === 'null';
  });
}
