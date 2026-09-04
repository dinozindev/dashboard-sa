# Shipment Insights Hub

Preciso que você construa um dashboard interativo de frete seguindo exatamente as regras de negócio descritas no arquivo Prompt_Lovable_Dashboard_Frete.md que estou anexando/colando abaixo. Esse documento contém todas as regras funcionais, técnicas e de cálculo do painel — mapa interativo, seleção de lojas (Aricanduva e Suzano), tooltip e detalhe de polígonos, integração com as planilhas Excel de frete, lógica de cálculo por faixa de peso, associação entre GeoJSON e Excel, filtros, legenda, cards de indicadores, horários de atendimento por modalidade (Entrega e Retira), capacidade operacional, simulador de peso, simulador de edição de faixas de preço, e comparação de preço em áreas de sobreposição entre as duas lojas.

Siga o documento como fonte única de verdade: não invente valores de frete, horário ou capacidade que não estejam nos dados ou nas regras descritas. Onde houver exemplos de estrutura (tabelas de horário, capacidade operacional, fórmulas de cálculo), implemente exatamente como especificado. As sugestões adicionais listadas no final do documento são opcionais, mas implemente-as se fizer sentido dentro do tempo/escopo.

Antes de começar a codar, analise a estrutura real dos 2 arquivos GeoJSON e das 2 planilhas Excel que vou enviar, para confirmar quais campos serão usados na associação polígono ↔ regra de frete, conforme descrito na Regra 7 do documento.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://clever-freight.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d2a3a578-83f7-4be4-9884-8c47346d200a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
