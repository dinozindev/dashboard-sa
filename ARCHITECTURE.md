# 🏗️ Arquitetura Técnica - Shipment Insights Hub

**Última atualização:** 2026-09-09

## 📑 Conteúdo

1. [Arquitetura Geral](#arquitetura-geral)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Padrões de Projeto](#padrões-de-projeto)
4. [State Management](#state-management)
5. [Integração de Dados](#integração-de-dados)
6. [Performance](#performance)
7. [Segurança](#segurança)
8. [Escalabilidade](#escalabilidade)

---

## 🏛️ Arquitetura Geral

### Layers (Camadas)

```
┌────────────────────────────────────────────────────────┐
│            PRESENTATION LAYER (UI)                      │
│  - React Components (JSX/TSX)                          │
│  - Tailwind CSS + Radix UI                             │
│  - Form handling, Event listeners                       │
└────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────┐
│         APPLICATION LAYER (State & Routing)             │
│  - TanStack Router (página, layout)                    │
│  - TanStack Query (cache, sync)                        │
│  - React Hooks (state local)                           │
└────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────┐
│          BUSINESS LOGIC LAYER (Lógica)                  │
│  - Lib/freight/* (geomática, preço, agendamento)       │
│  - Cálculos, transformações, validações                │
│  - Independent of React (funções puras)                │
└────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────┐
│           DATA LAYER (Persistência)                     │
│  - freight-data.json (GeoJSON + polígonos)             │
│  - shipping-policies.json (políticas)                  │
│  - IndexedDB/LocalStorage (opcional, cache)            │
└────────────────────────────────────────────────────────┘
```

### Fluxo de Dados

#### Unidirecional (Redux-like)
```
User Action
    ↓
Event Handler (onClick, onChange, etc)
    ↓
setState() / Dispatch
    ↓
Component Re-render
    ↓
DOM Update
```

#### Exemplo Concreto: Seleção de Polígono
```
User clica no mapa
    ↓
FreightMap.tsx::handleMapClick()
    ↓
polygonsAtPoint(lng, lat)  [geo.ts]
    ↓
setSelectedId(polygonId)  [useState]
    ↓
Dashboard re-renderiza com selectedId
    ↓
TariffTable.tsx filtra dados por selectedId
    ↓
calcPrice()  [pricing.ts]
    ↓
Exibe tabela de tarifas e preços
```

---

## 🧰 Stack Tecnológico

### Frontend Framework
| Tecnologia | Versão | Propósito |
|------------|--------|----------|
| React | 19 | Library de UI |
| TypeScript | Latest | Type safety |
| JSX/TSX | - | Templating |

### Roteamento
| Tecnologia | Versão | Propósito |
|------------|--------|----------|
| @tanstack/react-router | 1.170.18 | File-based routing (Vite plugin) |
| @tanstack/router-plugin | 1.168.23 | Gerador de tipos de rotas |

### Query & Data
| Tecnologia | Versão | Propósito |
|------------|--------|----------|
| @tanstack/react-query | 5.101.1 | Cache, sync, background updates |
| TanStack Start | 1.168.32 | Full-stack framework |

### UI & Styling
| Tecnologia | Versão | Propósito |
|------------|--------|----------|
| Tailwind CSS | 4.2.1 | Utility-first CSS |
| Radix UI | Latest | Headless components |
| class-variance-authority | 0.7.1 | Variant management |
| Shadcn/ui | - | Pre-built Radix components |

### Formulários
| Tecnologia | Versão | Propósito |
|------------|--------|----------|
| react-hook-form | Latest | Form state management |
| @hookform/resolvers | 5.2.2 | Validação (Zod, Yup, etc) |

### Mapa
| Tecnologia | Versão | Propósito |
|------------|--------|----------|
| Mapbox GL JS | Latest | Mapa interativo, polígonos |

### Build & Dev
| Tecnologia | Versão | Propósito |
|------------|--------|----------|
| Vite | Latest | Build tool, dev server |
| ESLint | Latest | Code linting |
| Prettier | Latest | Code formatting |

### Runtime
| Tecnologia | Versão | Propósito |
|------------|--------|----------|
| Node.js | 18+ | JavaScript runtime |
| Bun | Latest | Package manager (alternativa) |

---

## 🎨 Padrões de Projeto

### 1. Component Composition (Composição de Componentes)

```typescript
// ✅ BOM: Componentes pequenos, focados
interface CardProps {
  title: string
  children: ReactNode
}

function Card({ title, children }: CardProps) {
  return (
    <div className="border rounded">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

// Uso
<Card title="Tarifas">
  <TariffTable />
</Card>
```

### 2. Hooks Customizados (Custom Hooks)

```typescript
// ✅ BOM: Lógica reutilizável
function useSelectedPolygon(selectedId: string | null) {
  return useMemo(() => {
    if (!selectedId) return null
    return dataset.polygons.find(p => p.id === selectedId)
  }, [selectedId])
}

// Uso em múltiplos componentes
const polygon = useSelectedPolygon(selectedId)
```

### 3. Funções Puras (Pure Functions)

```typescript
// ✅ BOM: Sem side effects, testável, previsível
export function calcPrice(weight: number, band: WeightBand): number {
  if (!band.amc || !band.pew) return 0
  return band.amc + (weight - band.ws!) * band.pew
}

// ❌ EVITAR: Funções com side effects
function calcPrice(weight: number, band: WeightBand): number {
  console.log("Calculando preço...")  // Side effect!
  // ...
}
```

### 4. Lazy Loading (Code Splitting)

```typescript
// ✅ BOM: Carrega FreightMap só quando necessário
const FreightMap = lazy(() => import("./FreightMap"))

export function Dashboard() {
  return (
    <Suspense fallback={<Loading />}>
      <FreightMap />
    </Suspense>
  )
}
```

### 5. Presentational vs Container Components

```typescript
// ❌ ANTI-PATTERN: Componente faz tudo
function Dashboard() {
  const [selectedId, setSelectedId] = useState(null)
  const data = fetchData()  // Side effect no render!
  return <div>...</div>
}

// ✅ PADRÃO: Separação de responsabilidades
// Container (Dashboard.tsx)
function Dashboard() {
  const [selectedId, setSelectedId] = useState(null)
  return <TariffDisplay polygonId={selectedId} />
}

// Presentational (TariffDisplay.tsx)
interface Props {
  polygonId: string | null
}

function TariffDisplay({ polygonId }: Props) {
  const tariff = tariffFor(polygonId)
  return <table>...</table>
}
```

### 6. Memoization (Otimização)

```typescript
// ✅ BOM: Evita re-renders desnecessários
const FreightMap = memo(function FreightMap({ polygons, selectedId }) {
  return <MapGL polygons={polygons} selected={selectedId} />
})

// Também com useMemo para dados caros
const shownStores = useMemo(
  () => regionStores.filter((s) => visibleStores.includes(s)),
  [regionStores, visibleStores]
)
```

---

## 🔄 State Management

### Estratégia: Local State + Derived State

```
┌─────────────────────────────────────────────┐
│  Source of Truth (useState)                  │
├─────────────────────────────────────────────┤
│  - selectedId                                │
│  - weight                                    │
│  - region                                    │
│  - visibleStores                             │
│  - modality                                  │
│  - overrides                                 │
│  - ... (no Dashboard.tsx)                    │
└─────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────┐
│  Derived State (useMemo, funções)            │
├─────────────────────────────────────────────┤
│  - selectedPolygon = polygons.find(...)      │
│  - shownStores = regionStores.filter(...)    │
│  - tariff = tariffFor(selectedId)            │
│  - price = calcPrice(weight, tariff)         │
└─────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────┐
│  Presentation (componentes)                  │
└─────────────────────────────────────────────┘
```

### Props Drilling vs Context API

```typescript
// ❌ Props drilling profundo
<Dashboard>
  <Tab>
    <Panel>
      <Card>
        <Detail>
          {selectedId}  ← Passado por 5 níveis!
        </Detail>
      </Card>
    </Panel>
  </Tab>
</Dashboard>

// ✅ SOLUÇÃO: Context API
const DashboardContext = createContext<DashboardContextType>(null!)

function Dashboard() {
  const [selectedId, setSelectedId] = useState(null)
  return (
    <DashboardContext.Provider value={{ selectedId, setSelectedId }}>
      <Tab />
    </DashboardContext.Provider>
  )
}

function Detail() {
  const { selectedId } = useContext(DashboardContext)
  return <div>{selectedId}</div>
}
```

---

## 📥 Integração de Dados

### Carregamento de freight-data.json

```typescript
// src/lib/freight/dataset.ts
import FreightDatasetRaw from "@/data/freight-data.json"

interface FreightDataset {
  generatedAt: string
  sources: { geojson: string[]; excel: string }
  joinKey: string
  stores: StoreRef[]
  tariffs: WeightBand[][]
  polygons: PolygonRecord[]
}

export const FreightDataset: FreightDataset = FreightDatasetRaw as FreightDataset

// Índices para acesso O(1)
export const polygons = FreightDataset.polygons
export const tariffs = FreightDataset.tariffs
export const stores = FreightDataset.stores

// Funções helper
export function tariffFor(polygonId: string): WeightBand[] | null {
  const polygon = polygons.find(p => p.id === polygonId)
  if (!polygon || polygon.tariff === null) return null
  return tariffs[polygon.tariff]
}
```

### Estrutura do freight-data.json

```json
{
  "generatedAt": "2026-01-01T00:00:00Z",
  "sources": {
    "geojson": ["aricanduva.geojson", "suzano.geojson"],
    "excel": "tarifas.xlsx"
  },
  "joinKey": "band",
  "stores": [
    {
      "name": "Aricanduva",
      "center": [-46.5, -23.5],
      "note": "Matriz SP"
    }
  ],
  "tariffs": [
    [
      { "ws": 0, "we": 5, "amc": 10.00, "pew": 2.50 },
      { "ws": 5, "we": 10, "amc": 15.00, "pew": 2.00 }
    ]
  ],
  "polygons": [
    {
      "id": "ari_0_5kg_001",
      "store": "Aricanduva",
      "district": "Tatuape",
      "uf": "SP",
      "band": "0-5kg",
      "radius": 15,
      "rMin": 10,
      "rMax": 20,
      "areaKm2": 78.5,
      "center": [-46.5, -23.5],
      "tariff": 0,
      "geom": [[[[...]]]]
    }
  ]
}
```

---

## ⚡ Performance

### Estratégias

1. **Code Splitting (Lazy Loading)**
   ```typescript
   const FreightMap = lazy(() => import("./FreightMap"))
   ```

2. **Memoization**
   ```typescript
   const shownStores = useMemo(() => ..., [deps])
   const MemoComponent = memo(Component)
   ```

3. **Virtual Scrolling** (para listas grandes)
   ```typescript
   import { useVirtualizer } from '@tanstack/react-virtual'
   ```

4. **Índices em Memória**
   ```typescript
   const polygonById = useMemo(
     () => new Map(polygons.map(p => [p.id, p])),
     [polygons]
   )
   // Acesso O(1) em vez de O(n)
   ```

### Benchmarks

| Operação | Tempo Típico | Otimização |
|----------|--------------|-----------|
| Load freight-data.json | ~50ms | Already indexed |
| polygonsAtPoint(lng, lat) | <10ms | Geohash index (TODO) |
| calcPrice(weight, band) | <1ms | Pure function |
| Re-render Dashboard | ~100ms | Memoization, lazy components |

---

## 🔒 Segurança

### XSS Prevention
```typescript
// ✅ BOM: React escapa automaticamente
<div>{userInput}</div>

// ❌ EVITAR: innerHTML com user input
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

### Type Safety
```typescript
// ✅ TypeScript previne erros em compile time
function calcPrice(weight: number, band: WeightBand): number {
  return band.amc + (weight - band.ws!) * band.pew!
}

// ❌ JavaScript: Sem type checking
function calcPrice(weight, band) {
  return band.amc + (weight - band.ws) * band.pew  // NaN se undefined!
}
```

### Error Handling
```typescript
try {
  const price = calcPrice(weight, band)
} catch (error) {
  reportLovableError(error, { context: 'pricing' })
  showErrorNotification("Erro ao calcular preço")
}
```

---

## 📈 Escalabilidade

### Adicionar Novos Dados

1. **Nova Loja**
   - Adicionar em `StoreName` type
   - Incluir em `freight-data.json` → `stores`
   - Adicionar polígonos GeoJSON

2. **Novo Campo em Polígono**
   - Atualizar `PolygonRecord` interface
   - Regenerar `freight-data.json`
   - Atualizar componentes que usam

3. **Novos Indicadores (KPIs)**
   - Criar função em `src/lib/freight/`
   - Adicionar em `Kpis.tsx`

### Arquitetura para Escala

```typescript
// ❌ Monolítico: Difícil escalar
function Dashboard() {
  return (
    <div>
      {/* 100+ linhas de JSX */}
      {/* lógica misturada */}
      {/* difícil testar */}
    </div>
  )
}

// ✅ Modular: Fácil escalar
// src/components/dashboard/Dashboard.tsx
export function Dashboard() {
  return (
    <DashboardProvider>
      <MainGrid>
        <MapPanel />
        <DataPanel />
        <SimulatorPanel />
      </MainGrid>
    </DashboardProvider>
  )
}

// src/context/DashboardContext.tsx
export const DashboardContext = createContext<DashboardContextType>(...)
export function useDashboard() { return useContext(DashboardContext) }

// src/components/dashboard/MapPanel.tsx
export function MapPanel() {
  const { selectedId, setSelectedId } = useDashboard()
  return <FreightMap onSelect={setSelectedId} selected={selectedId} />
}

// src/components/dashboard/DataPanel.tsx
export function DataPanel() {
  const { selectedId } = useDashboard()
  return <TariffTable polygonId={selectedId} />
}
```

### Otimização com Geohash

Para datasets muito grandes, usar geohashing:

```typescript
// src/lib/freight/geo-index.ts
import GeoHash from 'geohash-slim'

class GeoIndex {
  private index: Map<string, PolygonRecord[]> = new Map()
  
  constructor(polygons: PolygonRecord[]) {
    for (const polygon of polygons) {
      const [lng, lat] = polygon.center
      const hash = GeoHash.encode(lat, lng, 6)  // Precision 6
      if (!this.index.has(hash)) {
        this.index.set(hash, [])
      }
      this.index.get(hash)!.push(polygon)
    }
  }
  
  // O(1) lookup + small subset check
  atPoint(lng: number, lat: number): PolygonRecord[] {
    const hash = GeoHash.encode(lat, lng, 6)
    return this.index.get(hash) || []
  }
}

export const geoIndex = new GeoIndex(polygons)
```

---

## 📊 Diagrama de Dependências

```
Dashboard.tsx (root)
├── FreightMap.tsx
│   └── lib/freight/geo.ts
├── Kpis.tsx
│   └── lib/freight/dataset.ts
├── TariffTable.tsx
│   ├── lib/freight/dataset.ts
│   ├── lib/freight/pricing.ts
│   └── lib/freight/types.ts
├── SchedulePanel.tsx
│   ├── lib/freight/schedule.ts
│   └── lib/freight/capacity.ts
├── RuleSimulator.tsx
│   ├── lib/freight/pricing.ts
│   └── state (overrides)
├── ComparePanel.tsx
│   ├── lib/freight/dataset.ts
│   └── lib/freight/geo.ts
└── PoliciesPanel.tsx
    └── lib/freight/policies.ts

lib/freight/dataset.ts
├── freight-data.json (import)
├── types.ts
└── palette.ts
```

---

## 🧪 Testing Strategy (Futuro)

```typescript
// __tests__/lib/freight/pricing.test.ts
import { calcPrice } from '@/lib/freight/pricing'

describe('calcPrice', () => {
  it('should calculate price correctly', () => {
    const band = { ws: 0, we: 5, amc: 10, pew: 2.5 }
    expect(calcPrice(3, band)).toBe(17.5)  // 10 + 3*2.5
  })
})

// __tests__/components/dashboard/TariffTable.test.tsx
import { render, screen } from '@testing-library/react'
import { TariffTable } from '@/components/dashboard/TariffTable'

describe('TariffTable', () => {
  it('renders tariff data', () => {
    render(<TariffTable polygonId="ari_0_5kg_001" />)
    expect(screen.getByText(/0-5kg/)).toBeInTheDocument()
  })
})
```

---

Desenvolvido com ❤️ usando [Lovable](https://lovable.dev)
