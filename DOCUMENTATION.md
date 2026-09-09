# 📚 Documentação - Shipment Insights Hub

**Última atualização:** 2026-09-09

## 📑 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Projeto](#arquitetura-do-projeto)
3. [Estrutura de Diretórios](#estrutura-de-diretórios)
4. [Módulos Principais](#módulos-principais)
5. [Guia de Setup](#guia-de-setup)
6. [Fluxo de Dados](#fluxo-de-dados)
7. [Componentes](#componentes)
8. [Tipos de Dados](#tipos-de-dados)
9. [Scripts Disponíveis](#scripts-disponíveis)
10. [Desenvolvimento](#desenvolvimento)

---

## 🎯 Visão Geral

**Shipment Insights Hub** é um dashboard interativo para gerenciar e visualizar dados de frete, com foco em:

- 📍 **Mapa Interativo**: Visualização geográfica de polígonos de serviço com GeoJSON
- 🏪 **Múltiplas Lojas**: Aricanduva, Suzano e outras filiais
- 📦 **Tarifas por Peso**: Cálculo dinâmico de preços baseado em faixas de peso
- 🚗 **Modalidades**: Entrega e Retira
- ⏰ **Horários**: Calendário de operação com feriados e horários por modalidade
- 📊 **Indicadores**: KPIs, tabelas de tarifa e comparação entre lojas
- 🔧 **Simuladores**: Ajuste de pesos e preços em tempo real
- 📋 **Políticas**: Visualização de políticas de envio e retirada

**Stack Tecnológico:**
- React 19 + TypeScript
- TanStack Router (roteamento)
- TanStack Query (gerenciamento de dados)
- Tailwind CSS + UI Components (Radix UI)
- Vite (build tool)
- Mapbox GL (mapa interativo)

---

## 🏗️ Arquitetura do Projeto

```
┌─────────────────────────────────────────────────────────┐
│                    DASHBOARD (UI)                        │
├─────────────────────────────────────────────────────────┤
│  Components:                                             │
│  - Dashboard.tsx (orquestrador principal)               │
│  - FreightMap (mapa com Mapbox)                         │
│  - Kpis (indicadores chave)                             │
│  - TariffTable (tabelas de frete)                       │
│  - SchedulePanel (horários e capacidade)                │
│  - PoliciesPanel (políticas)                            │
│  - RuleSimulator (simulador de peso/preço)              │
│  - ComparePanel (comparação entre lojas)                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                  FREIGHT LIB (Lógica)                    │
├─────────────────────────────────────────────────────────┤
│  - dataset.ts      (dados carregados, índices)          │
│  - types.ts        (tipos TypeScript)                   │
│  - geo.ts          (cálculos geográficos)               │
│  - pricing.ts      (cálculos de preço)                  │
│  - capacity.ts     (gerenciamento de capacidade)        │
│  - schedule.ts     (horários e operação)                │
│  - policies.ts     (políticas de envio/retira)          │
│  - palette.ts      (cores e bandas de peso)             │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│               DATA SOURCES (JSON)                        │
├─────────────────────────────────────────────────────────┤
│  - freight-data.json (GeoJSON + metadados)              │
│  - shipping-policies.json (políticas)                   │
└─────────────────────────────────────────────────────────┘
```

---

## 📂 Estrutura de Diretórios

```
dashboard-sa/
├── 📄 README.md                    # Início rápido
├── 📄 DOCUMENTATION.md             # Este arquivo
├── 📄 ARCHITECTURE.md              # Detalhes de arquitetura
├── 📄 TROUBLESHOOTING.md           # Resolução de problemas
│
├── 📁 public/
│   └── robots.txt
│
├── 📁 src/
│   ├── 📄 router.tsx               # Configuração de rotas
│   ├── 📄 server.ts                # Server-side (TanStack Start)
│   ├── 📄 start.ts                 # Entry point
│   ├── 📄 styles.css               # Estilos globais
│   │
│   ├── 📁 components/              # Componentes React
│   │   ├── 📁 dashboard/           # Dashboard principal
│   │   │   ├── Dashboard.tsx       # Orquestrador
│   │   │   ├── FreightMap.tsx      # Mapa interativo
│   │   │   ├── Kpis.tsx            # Indicadores chave
│   │   │   ├── TariffTable.tsx     # Tabela de tarifas
│   │   │   ├── SchedulePanel.tsx   # Horários/capacidade
│   │   │   ├── PoliciesPanel.tsx   # Políticas
│   │   │   ├── RuleSimulator.tsx   # Simulador
│   │   │   ├── ComparePanel.tsx    # Comparação
│   │   │   ├── PriceBreakdown.tsx  # Decomposição de preço
│   │   │   ├── CapacityPanel.tsx   # Capacidade operacional
│   │   │   └── Legend.tsx          # Legenda de cores
│   │   │
│   │   └── 📁 ui/                  # Componentes reutilizáveis
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── form.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       └── ... (20+ componentes Radix UI)
│   │
│   ├── 📁 data/                    # Dados estáticos
│   │   ├── freight-data.json       # GeoJSON + polígonos
│   │   └── shipping-policies.json  # Políticas
│   │
│   ├── 📁 hooks/                   # Custom React hooks
│   │   └── use-mobile.tsx          # Detecção de viewport mobile
│   │
│   ├── 📁 lib/                     # Funções utilitárias
│   │   ├── utils.ts                # Helpers gerais
│   │   ├── error-*.ts              # Tratamento de erros
│   │   ├── lovable-*.ts            # Integração Lovable
│   │   │
│   │   └── 📁 freight/             # Lógica de negócio de frete
│   │       ├── types.ts            # Tipos TypeScript
│   │       ├── dataset.ts          # Carregamento e índices
│   │       ├── geo.ts              # Geomática
│   │       ├── pricing.ts          # Cálculos de preço
│   │       ├── capacity.ts         # Capacidade
│   │       ├── schedule.ts         # Agendamento
│   │       ├── policies.ts         # Políticas
│   │       └── palette.ts          # Cores/visual
│   │
│   └── 📁 routes/                  # TanStack Router
│       ├── __root.tsx              # Layout raiz
│       └── index.tsx               # Página principal
│
├── 📁 scripts/                     # Scripts utilitários
│   ├── add-stores.py               # Adiciona lojas
│   └── build-freight-data.py       # Constrói dados de frete
│
├── 📄 package.json                 # Dependências
├── 📄 tsconfig.json                # TypeScript config
├── 📄 vite.config.ts               # Vite config
├── 📄 eslint.config.js             # ESLint config
├── 📄 components.json              # Shadcn/ui config
└── 📄 bunfig.toml                  # Bun config
```

---

## 🧩 Módulos Principais

### 1️⃣ **lib/freight/types.ts**
Define todos os tipos TypeScript do domínio de frete:

```typescript
type StoreName = "Aricanduva" | "Suzano" | "Mooca" | ...
type Modality = "Entrega" | "Retira"
type RegionSelection = "SP" | "RJ" | "Todas"

interface PolygonRecord {
  id: string
  store: StoreName
  band: string              // Faixa de peso
  tariff: number | null     // Índice na tabela de tarifas
  geom: number[][][][]      // Geometria MultiPolygon
  // ... mais campos
}

interface WeightBand {
  ws: number | null         // Weight_Start
  we: number | null         // Weight_End
  amc: number | null        // AbsoluteMoneyCost
  pew: number | null        // PriceByExtraWeight
}
```

### 2️⃣ **lib/freight/dataset.ts**
Carrega e expõe os dados de frete:

```typescript
export const FreightDataset: FreightDataset = { ... }
export const polygons: PolygonRecord[] = [ ... ]
export const tariffs: WeightBand[][] = [ ... ]
export const STORE_NAMES: StoreName[] = [ ... ]

// Funções de acesso
export function tariffFor(id: string): WeightBand[] | null
export function storesInRegion(region: RegionSelection): StoreName[]
export function hasSimulation(id: string): boolean
```

### 3️⃣ **lib/freight/geo.ts**
Utilitários geográficos:

```typescript
export function polygonsAtPoint(lng: number, lat: number): PolygonRecord[]
export function pointInPolygon(point: [number, number], polygon: PolygonRecord): boolean
// Cálculos de distância, área, etc.
```

### 4️⃣ **lib/freight/pricing.ts**
Cálculos de preço:

```typescript
export function calcPrice(weight: kg, band: WeightBand): number
export function brl(value: number): string  // Formatação BRL
export function kg(value: number): string   // Formatação kg
```

### 5️⃣ **lib/freight/schedule.ts**
Calendário e horários:

```typescript
export const HOLIDAYS: string[] = [ ... ]
export function isOperational(date: Date, modality: Modality): boolean
export function operatingHours(store: StoreName, modality: Modality): [start, end]
```

### 6️⃣ **lib/freight/capacity.ts**
Capacidade operacional:

```typescript
export interface CapacitySlot { ... }
export function availableCapacity(store: StoreName, date: Date): CapacitySlot[]
export function getOperatingStores(date: Date, modality: Modality): StoreName[]
```

### 7️⃣ **lib/freight/policies.ts**
Políticas de envio/retira:

```typescript
export const POLICIES: ShippingPolicy[] = [ ... ]
export function policiesFor(store: StoreName): ShippingPolicy[]
```

### 8️⃣ **lib/freight/palette.ts**
Cores e visual:

```typescript
export const BAND_ORDER: string[] = [ ... ]
export const BAND_COLORS: Record<string, string> = { ... }
export function colorForBand(band: string): string
```

---

## 📋 Guia de Setup

### Pré-requisitos
- **Node.js** >= 18.x (recomendado: 20.x)
- **npm** >= 9.x ou **yarn** >= 3.x

### Instalação Rápida

```bash
# 1. Clonar repositório
git clone https://github.com/seu-user/dashboard-sa.git
cd dashboard-sa

# 2. Instalar dependências
npm install

# 3. Iniciar desenvolvimento
npm run dev

# 4. Abrir no navegador
# Acesse: http://localhost:5173
```

### Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento (Vite) |
| `npm run build` | Build produção |
| `npm run build:dev` | Build modo desenvolvimento |
| `npm run preview` | Preview do build produção |
| `npm run lint` | Executa ESLint |
| `npm run format` | Formata código com Prettier |

---

## 🔄 Fluxo de Dados

### Carregamento de Dados

```
1. App Start (start.ts)
   ↓
2. Load freight-data.json (src/data/freight-data.json)
   ↓
3. Parse em PolygonRecord[] e WeightBand[][]
   ↓
4. Dataset.ts indexa dados para acesso rápido
   ↓
5. Componentes utilizam funções de acesso (tariffFor, polygonsAtPoint, etc)
```

### Fluxo de Interação

```
User Clica no Mapa
   ↓
FreightMap.tsx (onClick)
   ↓
polygonsAtPoint(lng, lat)  [geo.ts]
   ↓
setSelectedId, setPoint (state)
   ↓
Dashboard detecta mudança
   ↓
Re-render: TariffTable, PriceBreakdown, etc
   ↓
calcPrice() [pricing.ts]
   ↓
Exibição de resultados
```

### Simulação de Preço

```
User ajusta peso no RuleSimulator
   ↓
setWeight(newWeight)  [state]
   ↓
setOverrides({ [band]: newPrice })
   ↓
calcPrice(newWeight, overrides)
   ↓
PriceBreakdown mostra novo valor
```

---

## 🎨 Componentes

### Dashboard.tsx
**Orquestrador principal** - gerencia state global, coordena sub-componentes

**Props:** Nenhuma (root component)

**State:**
- `tab`: Aba ativa ("operacao" | "politicas")
- `region`: Região selecionada
- `visibleStores`: Lojas visíveis no mapa
- `weight`: Peso para cálculo
- `modality`: Modalidade ("Entrega" | "Retira")
- `selectedId`: ID do polígono selecionado
- `overrides`: Preços customizados

### FreightMap.tsx (Lazy-loaded)
**Mapa interativo com Mapbox GL**

**Funcionalidades:**
- Renderiza todos os polígonos
- Colorido por banda de peso
- Interativo (click → seleção)
- Tooltip ao passar mouse

### Kpis.tsx
**Indicadores chave**

Exibe:
- Número de polígonos
- Área total
- Lojas ativas
- Tariffas configuradas

### TariffTable.tsx
**Tabela de tarifas por peso**

Mostra:
- Faixas de peso (inicio - fim)
- Custo absoluto (Weight_Start)
- Preço por kg adicional
- Valor calculado para peso selecionado

### SchedulePanel.tsx
**Horários e capacidade**

Contém:
- `ScheduleGrid`: Calendário de operação
- `StatusBadge`: Status atual (aberto/fechado)
- Horários por modalidade
- Dias feriados marcados

### CapacityPanel.tsx
**Capacidade operacional**

Mostra:
- Slots disponíveis
- Lotação por horário
- Lojas com capacidade

### RuleSimulator.tsx
**Simulador de peso/preço**

Permite:
- Ajustar peso
- Editar preços por banda
- Ver impacto em tempo real

### ComparePanel.tsx
**Comparação entre lojas**

Mostra:
- Preços em áreas de sobreposição
- Diferenças de cobertura
- Análise comparativa

### PoliciesPanel.tsx
**Políticas de envio/retira**

Exibe:
- Regras de envio
- Regras de retirada
- Restrições

---

## 🔤 Tipos de Dados

### StoreName
Todas as filiais disponíveis:
```
"Aricanduva" | "Suzano" | "Mooca" | "Praia Grande" | "Piracicaba" | 
"Benfica" | "Duque de Caxias" | "Guadalupe" | "Jacarepagua" | "Mesquita" | "Niteroi"
```

### Modality
Tipos de operação:
```
"Entrega" | "Retira"
```

### RegionSelection
Regiões:
```
"SP" | "RJ" | "Todas"
```

### PolygonRecord
Registro de polígono:
```typescript
{
  id: string                    // Identificador único
  store: StoreName              // Loja responsável
  district: string | null       // Bairro
  uf: string | null             // UF (SP, RJ)
  band: string                  // Faixa de peso (ex: "0-5kg")
  radius: number                // Raio em km
  rMin: number                  // Raio mínimo
  rMax: number                  // Raio máximo
  areaKm2: number               // Área em km²
  center: [number, number]      // [lng, lat]
  tariff: number | null         // Índice na tabela de tarifas
  geom: number[][][][]          // MultiPolygon GeoJSON
}
```

### WeightBand
Faixa de preço por peso:
```typescript
{
  ws: number | null             // Weight_Start (Kg)
  we: number | null             // Weight_End (Kg)
  amc: number | null            // AbsoluteMoneyCost (R$)
  pew: number | null            // PriceByExtraWeight (R$/kg)
}
```

---

## 🛠️ Scripts Python

### build-freight-data.py
Constrói o arquivo `freight-data.json` a partir de:
- Arquivos GeoJSON (polígonos)
- Planilha Excel (tarifas)

**Uso:**
```bash
python scripts/build-freight-data.py --geojson data/*.geojson --excel data/tarifas.xlsx
```

### add-stores.py
Adiciona novas lojas ao dataset

**Uso:**
```bash
python scripts/add-stores.py --name "Nova Loja" --lat -23.5 --lng -46.6
```

---

## 👨‍💻 Desenvolvimento

### Adicionando um Novo Componente

1. Criar arquivo em `src/components/dashboard/`
2. Usar o padrão:
   ```typescript
   interface Props {
     selectedId?: string | null
     // ... props específicas
   }
   
   export function MeuComponente({ selectedId }: Props) {
     return (
       // JSX
     )
   }
   ```
3. Importar e adicionar ao Dashboard.tsx

### Adicionando Nova Loja

1. Adicionar em `src/lib/freight/types.ts` -> `StoreName` type
2. Atualizar `freight-data.json`
3. Adicionar polígonos no GeoJSON
4. Executar `npm run build-freight-data`

### Adicionando Nova Funcionalidade de Preço

1. Criar função em `src/lib/freight/pricing.ts`
2. Importar em componentes necessários
3. Testar com RuleSimulator

### Debugging

- Abrir DevTools: `F12`
- Console: Ver logs
- Network: Verificar carregamento de dados
- Application → Local Storage: State persistido

---

## 📞 Suporte

Para problemas, consulte [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

Desenvolvido com ❤️ usando [Lovable](https://lovable.dev)
