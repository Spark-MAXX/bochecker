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
  // Campos verificados NO PAYLOAD PROCESSADO pelo n8n (após "Processar dados da LP1")
  // page_url = campo real enviado pelo Framer (não "url")
  // faz_influencia = campo mapeado de Frequencia_de_campanhas_de_marketing
  lp_sprout: [
    'nome', 'email', 'telefone', 'empresa',
    'voce_e', 'o_que_busca', 'faz_influencia',
    'page_url', 'utm_source', 'utm_medium', 'utm_campaign',
  ],
  lp_community: [
    'nome', 'email', 'telefone', 'empresa',
    'cargo', 'tamanho_da_empresa', 'faz_influencia',
    'page_url', 'utm_source', 'utm_medium', 'utm_campaign',
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
    'page_url', 'utm_source', 'utm_medium', 'utm_campaign',
  ],
  // Campos verificados em $json._lead (objeto aninhado do node "Processar tags, UTMs e rotas1")
  // Removidos: pipedrive_person_id, pipedrive_deal_id, label (criados PELO workflow, não chegam no input)
  rd_pipe: [
    'lead_nome', 'lead_email', 'lead_telefone',
    'rota_definida', 'destino_pipeline_id', 'destino_stage_id', 'destino_owner_id',
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
