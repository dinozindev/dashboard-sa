# 📊 Shipment Insights Hub - Componentes

**Última atualização:** 2026-09-09

## 📑 Índice de Componentes

### Dashboard
- [Dashboard.tsx](#dashboardtsx) - Orquestrador principal
- [FreightMap.tsx](#freightmaptsx) - Mapa interativo
- [Kpis.tsx](#kpistsx) - Indicadores chave
- [TariffTable.tsx](#tarifftabletsx) - Tabela de tarifas
- [SchedulePanel.tsx](#schedulepaneltsx) - Horários e capacidade
- [CapacityPanel.tsx](#capacitypaneltsx) - Capacidade operacional
- [PricBreakdown.tsx](#pricebreakdowntsx) - Decomposição de preço
- [RuleSimulator.tsx](#rulesimulator tsx) - Simulador de peso/preço
- [ComparePanel.tsx](#comparepaneltsx) - Comparação de lojas
- [PoliciesPanel.tsx](#policiespaneltsx) - Políticas
- [Legend.tsx](#legendtsx) - Legenda de cores

### UI Components (Radix UI)
Lista de 30+ componentes reutilizáveis

---

## 🎨 Componentes do Dashboard

### Dashboard.tsx

**Descrição:** Componente raiz que orquestra todo o dashboard. Gerencia estado global, coordena sub-componentes e sincroniza interações.

**Arquivo:** [src/components/dashboard/Dashboard.tsx](src/components/dashboard/Dashboard.tsx)

**Props:** Nenhuma (Root component)

**State:**
```typescript
{
  tab: "operacao" | "politicas"           // Aba ativa
  region: "SP" | "RJ" | "Todas"           // Região selecionada
  visibleStores: StoreName[]              // Lojas visíveis no mapa
  compareStores: StoreName[]              // Lojas para comparação
  storesOpen: boolean                     // Dropdown aberto?
  bands: string[]                         // Bandas visíveis
  search: string                          // Texto de busca
  weight: number                          // Peso para cálculo (kg)
  modality: "Entrega" | "Retira"         // Modalidade selecionada
  selectedId: string | null               // ID do polígono selecionado
  bandIndex: number | null                // Index de banda selecionada
  overrides: Record<string, number>       // Preços customizados
  point: { lng: number; lat: number } | null  // Ponto clicado no mapa
  now: Date                               // Data/hora atual
}
```

**Uso:**
```typescript
import Dashboard from "@/routes/index"

export default function Page() {
  return <Dashboard />
}
```

**Estrutura HTML:**
```
<Dashboard>
  ├── <Tabs> (operacao | politicas)
  │   ├── Tab "operacao"
  │   │   ├── <FreightMap /> (lazy)
  │   │   ├── <Sidebar>
  │   │   │   ├── <RegionSelector />
  │   │   │   ├── <StoreSelector />
  │   │   │   ├── <ModalitySelector />
  │   │   │   └── <WeightSlider />
  │   │   └── <ContentArea>
  │   │       ├── <Tabs> (kpis | tarifa | comparacao | simulador)
  │   │       │   ├── <Kpis />
  │   │       │   ├── <TariffTable />
  │   │       │   ├── <ComparePanel />
  │   │       │   ├── <RuleSimulator />
  │   │       │   └── <SchedulePanel />
  │   │       └── <Aside> (details)
  │   │           ├── <PriceBreakdown />
  │   │           └── <CapacityPanel />
  │   │
  │   └── Tab "politicas"
  │       └── <PoliciesPanel />
  │
  └── <Legend /> (sempre visível)
```

---

### FreightMap.tsx

**Descrição:** Mapa interativo baseado em Mapbox GL. Renderiza polígonos, marcadores de loja, permite seleção por click.

**Arquivo:** [src/components/dashboard/FreightMap.tsx](src/components/dashboard/FreightMap.tsx)

**Props:**
```typescript
interface Props {
  polygons: PolygonRecord[]              // Polígonos a renderizar
  selectedId?: string | null             // ID do polígono selecionado
  onSelect?: (id: string | null) => void // Callback ao selecionar
  onPointClick?: (lng: number, lat: number) => void  // Ao clicar no mapa
  visibleBands?: string[]                // Bandas a exibir
  centered?: boolean                     // Auto-center no selecionado?
}
```

**Exemplo:**
```typescript
<FreightMap
  polygons={dataset.polygons}
  selectedId={selectedId}
  onSelect={setSelectedId}
  onPointClick={(lng, lat) => setPoint({ lng, lat })}
  visibleBands={bands}
  centered
/>
```

**Funcionalidades:**
- 🗺️ Mapa base (Mapbox Streets, Satellite, etc)
- 🎯 Polígonos coloridos por banda
- 📍 Marcadores de loja
- 🖱️ Click para selecionar polígono
- 🔍 Zoom/Pan
- 🎨 Legenda interativa
- 💬 Tooltip ao passar mouse

**Eventos:**
```typescript
// Click no polígono
map.on('click', 'polygons-fill', (e) => {
  const properties = e.features[0].properties
  onSelect?.(properties.id)
})

// Hover
map.on('mouseenter', 'polygons-fill', () => {
  map.getCanvas().style.cursor = 'pointer'
})

map.on('mouseleave', 'polygons-fill', () => {
  map.getCanvas().style.cursor = ''
})
```

---

### Kpis.tsx

**Descrição:** Painel com indicadores-chave do frete. Mostra resumo estatístico dos dados.

**Arquivo:** [src/components/dashboard/Kpis.tsx](src/components/dashboard/Kpis.tsx)

**Props:**
```typescript
interface Props {
  polygons: PolygonRecord[]              // Dados para cálculo
  selectedId?: string | null             // Para highlight
  visibleStores?: StoreName[]            // Filtrar lojas
}
```

**Exemplo:**
```typescript
<Kpis
  polygons={dataset.polygons}
  selectedId={selectedId}
  visibleStores={visibleStores}
/>
```

**Indicadores Exibidos:**
| KPI | Descrição | Cálculo |
|-----|-----------|---------|
| Polígonos | Número total | `polygons.length` |
| Área Total | Soma de áreas | `sum(areaKm2)` |
| Lojas | Lojas com serviço | `unique(store)` |
| Regiões | SP + RJ | `unique(uf)` |
| Tariffas | Regras configuradas | `unique(tariff).filter(t => t !== null)` |
| Média Raio | Cobertura média | `avg(radius)` |

---

### TariffTable.tsx

**Descrição:** Tabela de tarifas por faixa de peso. Exibe regras de preço do polígono selecionado.

**Arquivo:** [src/components/dashboard/TariffTable.tsx](src/components/dashboard/TariffTable.tsx)

**Props:**
```typescript
interface Props {
  polygonId?: string | null              // ID do polígono selecionado
  weight?: number                        // Peso para cálculo
  modality?: "Entrega" | "Retira"       // Modalidade
  overrides?: Record<string, number>     // Preços customizados
}
```

**Exemplo:**
```typescript
<TariffTable
  polygonId={selectedId}
  weight={weight}
  modality={modality}
  overrides={overrides}
/>
```

**Colunas:**
| Coluna | Descrição | Fonte |
|--------|-----------|-------|
| Banda | Faixa de peso (ex: 0-5kg) | `WeightBand.band` |
| Início | Weight_Start | `WeightBand.ws` |
| Fim | Weight_End | `WeightBand.we` |
| Custo Base | AbsoluteMoneyCost | `WeightBand.amc` |
| Preço/kg Extra | PriceByExtraWeight | `WeightBand.pew` |
| Preço Calculado | Fórmula: amc + (peso - ws) * pew | Dinâmico |
| Status | ✅ Ativo / ⚠️ Sobreposto | RuleSimulator |

---

### SchedulePanel.tsx

**Descrição:** Calendário e horários de operação. Mostra disponibilidade por loja, modalidade e data.

**Arquivo:** [src/components/dashboard/SchedulePanel.tsx](src/components/dashboard/SchedulePanel.tsx)

**Props:**
```typescript
interface Props {
  stores: StoreName[]                    // Lojas a exibir
  modality: "Entrega" | "Retira"        // Modalidade
  selectedDate?: Date                    // Data selecionada
  onSelectDate?: (date: Date) => void   // Callback
}
```

**Sub-componentes:**
- `ScheduleGrid`: Calendário com dias operacionais
- `StatusBadge`: Status atual (Aberto/Fechado)

**Exemplo:**
```typescript
<SchedulePanel
  stores={shownStores}
  modality={modality}
  selectedDate={now}
  onSelectDate={setNow}
/>
```

**Funcionalidades:**
- 📅 Calendário interativo
- 🟢 Dias operacionais destacados
- 🔴 Feriados marcados
- ⏰ Horários por modalidade
- 📊 Capacidade disponível

**Dados:**
```typescript
// src/lib/freight/schedule.ts
export const HOLIDAYS = ['2026-01-01', '2026-12-25', ...]
export const OPERATING_HOURS: Record<StoreName, Record<Modality, [string, string]>> = {
  'Aricanduva': {
    'Entrega': ['08:00', '17:00'],
    'Retira': ['09:00', '18:00']
  }
}
```

---

### CapacityPanel.tsx

**Descrição:** Capacidade operacional por horário. Mostra slots disponíveis e lotação.

**Arquivo:** [src/components/dashboard/CapacityPanel.tsx](src/components/dashboard/CapacityPanel.tsx)

**Props:**
```typescript
interface Props {
  store: StoreName                       // Loja selecionada
  date: Date                             // Data selecionada
  modality: "Entrega" | "Retira"        // Modalidade
}
```

**Exemplo:**
```typescript
<CapacityPanel
  store={selectedStore}
  date={now}
  modality={modality}
/>
```

**Estrutura de Dados:**
```typescript
interface CapacitySlot {
  time: string                // "08:00"
  capacity: number            // Capacidade total
  used: number                // Já reservado
  available: number           // Livre
  percentage: number          // %ocupação
}
```

**Visuals:**
- Barras de progresso por slot
- Cores: Verde (livre) → Amarelo (80%+) → Vermelho (cheio)

---

### PriceBreakdown.tsx

**Descrição:** Decomposição visual do cálculo de preço. Mostra cada componente da fórmula.

**Arquivo:** [src/components/dashboard/PriceBreakdown.tsx](src/components/dashboard/PriceBreakdown.tsx)

**Props:**
```typescript
interface Props {
  weight: number                         // Peso (kg)
  band: WeightBand | null               // Faixa selecionada
  store?: StoreName                     // Loja (para contexto)
}
```

**Exemplo:**
```typescript
<PriceBreakdown
  weight={10}
  band={selectedBand}
  store="Aricanduva"
/>
```

**Fórmula Exibida:**
```
Preço Total = Custo Base + (Peso Extra × Preço/kg)

Exemplo (Aricanduva, 10kg, Banda 5-20kg):
Preço Total = R$ 15,00 + ((10 - 5) × R$ 2,00)
Preço Total = R$ 15,00 + (5 × R$ 2,00)
Preço Total = R$ 15,00 + R$ 10,00
Preço Total = R$ 25,00
```

---

### RuleSimulator.tsx

**Descrição:** Simulador interativo de pesos e preços. Permite testar diferentes cenários e ajustar regras.

**Arquivo:** [src/components/dashboard/RuleSimulator.tsx](src/components/dashboard/RuleSimulator.tsx)

**Props:**
```typescript
interface Props {
  selectedPolygon?: PolygonRecord | null     // Para contexto
  weight: number                             // Peso inicial
  onWeightChange: (weight: number) => void  // Callback
  overrides: Record<string, number>          // Preços override
  onOverridesChange: (overrides: Overrides) => void  // Callback
}
```

**Exemplo:**
```typescript
<RuleSimulator
  selectedPolygon={selectedPolygon}
  weight={weight}
  onWeightChange={setWeight}
  overrides={overrides}
  onOverridesChange={setOverrides}
/>
```

**Funcionalidades:**
- 🎚️ Slider de peso (0-100 kg)
- 📝 Inputs para editar preços por banda
- 🔄 Modo preview vs aplicar
- ↩️ Botão desfazer
- 💾 Botão aplicar

**Simulação:**
```
User ajusta peso para 8kg
    ↓
onWeightChange(8)
    ↓
Dashboard recalcula:
    - Nova banda (5-10kg)
    - Novo preço
    - Atualiza TariffTable e PriceBreakdown em tempo real
```

---

### ComparePanel.tsx

**Descrição:** Comparação de tarifas entre duas lojas. Útil para áreas de sobreposição.

**Arquivo:** [src/components/dashboard/ComparePanel.tsx](src/components/dashboard/ComparePanel.tsx)

**Props:**
```typescript
interface Props {
  store1: StoreName                      // Primeira loja
  store2: StoreName                      // Segunda loja
  weight: number                         // Peso para comparação
  point?: { lng: number; lat: number }  // Ponto do mapa
}
```

**Exemplo:**
```typescript
<ComparePanel
  store1="Aricanduva"
  store2="Suzano"
  weight={10}
  point={point}
/>
```

**Colunas:**
| Campo | Aricanduva | Suzano | Diferença |
|-------|-----------|--------|-----------|
| Banda | 5-10kg | 5-10kg | - |
| Custo Base | R$ 15,00 | R$ 12,00 | -R$ 3,00 |
| Preço/kg | R$ 2,00 | R$ 2,50 | +R$ 0,50 |
| Total (10kg) | R$ 25,00 | R$ 24,50 | -R$ 0,50 |

---

### PoliciesPanel.tsx

**Descrição:** Exibe políticas de envio e retirada. Regras de operação por loja.

**Arquivo:** [src/components/dashboard/PoliciesPanel.tsx](src/components/dashboard/PoliciesPanel.tsx)

**Props:**
```typescript
interface Props {
  stores?: StoreName[]                   // Filtrar por lojas
  modality?: "Entrega" | "Retira"       // Filtrar por modalidade
}
```

**Exemplo:**
```typescript
<PoliciesPanel
  stores={visibleStores}
  modality={modality}
/>
```

**Dados:**
```typescript
// src/data/shipping-policies.json
{
  "policies": [
    {
      "store": "Aricanduva",
      "modality": "Entrega",
      "rule": "Máximo 100kg por pedido",
      "priority": 1
    }
  ]
}
```

---

### Legend.tsx

**Descrição:** Legenda visual com cores e significados. Explica as bandas de peso.

**Arquivo:** [src/components/dashboard/Legend.tsx](src/components/dashboard/Legend.tsx)

**Props:**
```typescript
interface Props {
  bands: string[]                        // Bandas a exibir
  selectedBand?: string | null           // Banda destacada
  onSelectBand?: (band: string) => void // Callback
}
```

**Exemplo:**
```typescript
<Legend
  bands={bands}
  selectedBand={selectedBand}
  onSelectBand={setBandIndex}
/>
```

**Visual:**
```
┌─────────────────────────────┐
│ LEGENDA - Faixas de Peso    │
├─────────────────────────────┤
│ ⬜ 0-5kg   (Vermelho)        │
│ ⬜ 5-10kg  (Laranja)         │
│ ⬜ 10-20kg (Amarelo)         │
│ ⬜ 20-50kg (Verde)           │
│ ⬜ 50kg+   (Azul)            │
└─────────────────────────────┘
```

---

## 🎛️ UI Components (Radix UI)

Todos os componentes de UI foram importados do Shadcn/ui (wrapper do Radix UI):

### Componentes Disponíveis

| Componente | Arquivo | Uso |
|------------|---------|-----|
| Button | [ui/button.tsx](src/components/ui/button.tsx) | Botões de ação |
| Card | [ui/card.tsx](src/components/ui/card.tsx) | Container de conteúdo |
| Dialog | [ui/dialog.tsx](src/components/ui/dialog.tsx) | Modais |
| Tabs | [ui/tabs.tsx](src/components/ui/tabs.tsx) | Abas |
| Table | [ui/table.tsx](src/components/ui/table.tsx) | Tabelas |
| Select | [ui/select.tsx](src/components/ui/select.tsx) | Dropdowns |
| Slider | [ui/slider.tsx](src/components/ui/slider.tsx) | Controles deslizantes |
| Form | [ui/form.tsx](src/components/ui/form.tsx) | Formulários |
| Input | [ui/input.tsx](src/components/ui/input.tsx) | Campos de texto |
| Checkbox | [ui/checkbox.tsx](src/components/ui/checkbox.tsx) | Checkboxes |
| Toggle | [ui/toggle.tsx](src/components/ui/toggle.tsx) | Botões toggle |
| Tooltip | [ui/tooltip.tsx](src/components/ui/tooltip.tsx) | Dicas |
| Alert | [ui/alert.tsx](src/components/ui/alert.tsx) | Alertas |
| Badge | [ui/badge.tsx](src/components/ui/badge.tsx) | Tags/badges |
| Calendar | [ui/calendar.tsx](src/components/ui/calendar.tsx) | Seletor de data |
| Pagination | [ui/pagination.tsx](src/components/ui/pagination.tsx) | Paginação |
| Progress | [ui/progress.tsx](src/components/ui/progress.tsx) | Barras de progresso |
| ScrollArea | [ui/scroll-area.tsx](src/components/ui/scroll-area.tsx) | Scroll customizado |
| Separator | [ui/separator.tsx](src/components/ui/separator.tsx) | Linhas divisórias |
| Drawer | [ui/drawer.tsx](src/components/ui/drawer.tsx) | Drawers/sidebars |
| Sheet | [ui/sheet.tsx](src/components/ui/sheet.tsx) | Sheets |
| RadioGroup | [ui/radio-group.tsx](src/components/ui/radio-group.tsx) | Radio buttons |
| Switch | [ui/switch.tsx](src/components/ui/switch.tsx) | Toggle switches |
| Popover | [ui/popover.tsx](src/components/ui/popover.tsx) | Popovers |
| HoverCard | [ui/hover-card.tsx](src/components/ui/hover-card.tsx) | Cards ao hover |
| DropdownMenu | [ui/dropdown-menu.tsx](src/components/ui/dropdown-menu.tsx) | Menus dropdown |
| ContextMenu | [ui/context-menu.tsx](src/components/ui/context-menu.tsx) | Menus de contexto |
| Collapsible | [ui/collapsible.tsx](src/components/ui/collapsible.tsx) | Seções colapsáveis |
| Skeleton | [ui/skeleton.tsx](src/components/ui/skeleton.tsx) | Loading skeletons |
| + 10 mais | ... | ... |

### Exemplo de Uso

```typescript
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Título</CardTitle>
      </CardHeader>
      <CardContent>
        <Select defaultValue="option1">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Opção 1</SelectItem>
            <SelectItem value="option2">Opção 2</SelectItem>
          </SelectContent>
        </Select>
        <Button>Ação</Button>
      </CardContent>
    </Card>
  )
}
```

---

## 🔄 Padrão de Props

Todos os componentes seguem este padrão:

```typescript
interface ComponentProps {
  // Dados obrigatórios
  data: DataType
  
  // Dados opcionais com defaults
  label?: string
  className?: string
  
  // Callbacks
  onChange?: (value: DataType) => void
  onSelect?: (id: string) => void
}

export function MyComponent({ data, label, onChange, ...props }: ComponentProps) {
  return (
    // JSX
  )
}
```

---

## 🎨 Styling

Todos os componentes usam:
- **Tailwind CSS**: Utility classes
- **Class Variance Authority (CVA)**: Variantes de estilos
- **CSS Modules**: Opcional, para estilos complexos

Exemplo:
```typescript
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md px-4 py-2",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white",
        secondary: "bg-gray-200 text-gray-900"
      },
      size: {
        sm: "text-sm",
        md: "text-base"
      }
    }
  }
)

export function Button({ variant = "default", size = "md", ...props }: ButtonProps) {
  return <button className={buttonVariants({ variant, size })} {...props} />
}
```

---

## 📚 Recursos

- [Shadcn/ui Docs](https://ui.shadcn.com)
- [Radix UI Docs](https://radix-ui.com)
- [Tailwind CSS Docs](https://tailwindcss.com)
- [React Docs](https://react.dev)

Desenvolvido com ❤️ usando [Lovable](https://lovable.dev)
