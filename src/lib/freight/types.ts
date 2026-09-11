/**
 * TIPOS E CONSTANTES DE DOMÍNIO
 * ==============================
 * Definições de tipos TypeScript para o sistema de frete.
 * Estes tipos são a base para todo o código de negócio.
 */

/**
 * Nome de uma unidade de frete/loja.
 * Valores: Aricanduva, Suzano (SP) + Benfica, Duque de Caxias, etc. (RJ)
 */
export type StoreName =
  | "Aricanduva"
  | "Suzano"
  | "Mooca"
  | "Praia Grande"
  | "Piracicaba"
  | "Benfica"
  | "Duque de Caxias"
  | "Guadalupe"
  | "Jacarepagua"
  | "Mesquita"
  | "Niteroi";

/** Seleção de loja: nome específico ou "Ambas" (quando aplicável) */
export type StoreSelection = StoreName | "Ambas";

/** Região brasileira: São Paulo ou Rio de Janeiro */
export type Region = "SP" | "RJ";

/** Seleção de região: SP, RJ, ou "Todas" */
export type RegionSelection = Region | "Todas";

/** Tipo de operação: Entrega (despache) ou Retira (retirada) */
export type Modality = "Entrega" | "Retira";


/**
 * Faixa de preço por faixa de peso.
 * 
 * Lida diretamente da planilha Excel de tarifas.
 * Somente leitura — não modificar depois de carregada.
 * 
 * Fórmula de cálculo:
 * - Se Weight_Start <= peso <= Weight_End: preço = AbsoluteMoneyCost
 * - Se peso > Weight_End: preço = AbsoluteMoneyCost + (peso - Weight_End) * PriceByExtraWeight
 */
export interface WeightBand {
  /** Weight_Start: Início da faixa (kg) */
  ws: number | null;
  /** Weight_End: Fim da faixa (kg) */
  we: number | null;
  /** AbsoluteMoneyCost: Preço base da faixa (R$) */
  amc: number | null;
  /** PriceByExtraWeight: Preço por kg adicional (R$/kg) */
  pew: number | null;
  /** PricePercent: percentual aplicado sobre o valor do pedido */
  pct?: number | null;
  /** MaxVolume: volume máximo permitido */
  maxVol?: number | null;
  /** TimeCost: prazo (ex.: "2.00:00:00") */
  time?: string | null;
  /** Country: país da regra (ex.: "BRA") */
  country?: string | null;
  /** MinimumValueInsurance: valor mínimo de seguro */
  minIns?: number | null;
}

/**
 * Registro de polígono de cobertura.
 * 
 * Representa uma área geográfica de entrega com geometria GeoJSON (MultiPolygon).
 * Cada polígono está associado a uma loja e a uma faixa de peso.
 * Pode opcionalmente estar associado a uma tabela de tarifas via índice.
 */
export interface PolygonRecord {
  /** ID único do polígono (ex: "ari_0_5kg_001") */
  id: string;
  /** Loja responsável por essa área */
  store: StoreName;
  /** Município/distrito (ex: "Tatuapé") */
  district: string | null;
  /** Unidade federativa (SP, RJ) */
  uf: string | null;
  /** Faixa de peso coberta (ex: "0-5kg", "5-10kg") */
  band: string;
  /** Raio de cobertura aproximado (km) */
  radius: number;
  /** Raio mínimo (km) */
  rMin: number;
  /** Raio máximo (km) */
  rMax: number;
  /** Área aproximada (km²) */
  areaKm2: number;
  /** Centro geográfico [longitude, latitude] */
  center: [number, number];
  /** Índice na tabela de tarifas (dataset.tariffs[tariff]).
   *  null = sem regra de frete configurada para este polígono */
  tariff: number | null;
  /** Geometria GeoJSON MultiPolygon: [polígono][anel][ponto][lng,lat]
   *  Anel 0 = contorno externo, anéis 1+ = buracos (holes) */
  geom: number[][][][];
}

/**
 * Referência a uma loja.
 * Usada na inicialização e para exibir dados de loja.
 */
export interface StoreRef {
  /** Nome da loja */
  name: StoreName;
  /** Localização central [longitude, latitude] */
  center: [number, number];
  /** Descrição/nota (ex: "Matriz SP", "Filial RJ") */
  note: string;
}

/**
 * Dataset completo de frete.
 * 
 * Importado do arquivo freight-data.json.
 * Contém todos os dados necessários para operação do dashboard:
 * - Metadados de fonte
 * - Tabelas de tarifa (faixas de peso por loja)
 * - Polígonos de cobertura com geometria GeoJSON
 * - Referências de lojas
 */
export interface FreightDataset {
  /** Data/hora de geração do arquivo (ISO 8601) */
  generatedAt: string;
  /** Fontes de dados: quais GeoJSONs e qual Excel foram usados */
  sources: { geojson: string[]; excel: string };
  /** Chave de junção (ex: "band") para associar polígono ↔ tarifa */
  joinKey: string;
  /** Lista de referências de lojas */
  stores: StoreRef[];
  /** Tabelas de tarifa: tariffs[indexDoPolígono] = WeightBand[] */
  tariffs: WeightBand[][];
  /** Lista de todos os polígonos de cobertura */
  polygons: PolygonRecord[];
}
