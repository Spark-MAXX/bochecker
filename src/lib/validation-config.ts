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

// Campos validados no payload PROCESSADO pelo n8n (campo real → nome real)
// Arrays marcados com [] são verificados como não-vazios
export const REQUIRED_FIELDS: Record<LeadSource, string[]> = {

  // ── LP Sprout (Framer) ── payload de "Processar dados da LP1"
  lp_sprout: [
    // Dados do lead
    'nome', 'email', 'telefone', 'empresa',
    // Qualificação
    'voce_e', 'o_que_busca', 'faz_influencia',
    // Produto e origem
    'produto', 'conversion_identifier',
    // Rastreamento (page_url = campo real do Framer, não "url")
    'page_url', 'utm_source', 'utm_medium', 'utm_campaign',
    // Tags (array — deve ter pelo menos 1)
    'tags',
  ],

  // ── LP Community (Framer) ── payload de "Processar dados da LP1"
  lp_community: [
    // Dados do lead
    'nome', 'email', 'telefone', 'empresa',
    // Qualificação específica de Community
    'cargo', 'tamanho_da_empresa', 'faz_influencia',
    // Produto e origem
    'produto', 'conversion_identifier',
    // Rastreamento
    'page_url', 'utm_source', 'utm_medium', 'utm_campaign',
  ],

  // ── Site Spark (form RD nativo) ── UTMs não chegam nesse fluxo
  site_spark: [
    'nome', 'email', 'telefone', 'empresa',
    'voce_e', 'frequencia', 'budget', 'o_que_busca',
    'conversion_url', 'conversion_identifier',
  ],

  // ── Indicação Interna (Framer) ── nomes reais do output de "Processar indicação"
  indicacao: [
    // Quem indica (Sparker)
    'indicador_nome', 'indicador_email',
    // Quem é indicado
    'nome', 'email', 'telefone', 'empresa',
    // Produto
    'produto_tag',
    // Origem
    'page_url',
  ],

  // ── RD → Pipedrive ── campos de $json._lead (após "Processar tags, UTMs e rotas1")
  // pipedrive_person_id e pipedrive_deal_id são CRIADOS pelo workflow — não chegam no input
  rd_pipe: [
    // Dados do lead
    'lead_nome', 'lead_email', 'lead_telefone', 'lead_empresa',
    // Roteamento (crítico — sem isso o lead não vai para o Pipedrive correto)
    'rota_definida', 'destino_pipeline_id', 'destino_stage_id', 'destino_owner_id',
    // Tags RD (array — deve ter pelo menos 1)
    'tags_rd',
    // Rastreamento de origem
    'utm_source', 'utm_campaign', 'url_bruta',
  ],
};

// Campos cujo valor deve ser um array não-vazio (além de não-null)
export const ARRAY_FIELDS: Partial<Record<LeadSource, string[]>> = {
  lp_sprout:    ['tags'],
  lp_community: [],
  rd_pipe:      ['tags_rd'],
};

export function validateLeadFields(
  payload: Record<string, any>,
  source: LeadSource,
): string[] {
  const required = REQUIRED_FIELDS[source] || [];
  const arrayFields = ARRAY_FIELDS[source] || [];

  return required.filter(field => {
    const val = payload[field];

    // Campo completamente ausente ou nulo/vazio
    if (val === undefined || val === null || val === '' || val === 'null') return true;

    // Array vazio (ex: tags: [])
    if (arrayFields.includes(field) && Array.isArray(val) && val.length === 0) return true;

    return false;
  });
}
