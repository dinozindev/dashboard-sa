# Migrar os dados do navegador para o banco

Hoje tudo vive em dois lugares frágeis: arquivos fixos dentro do projeto (polígonos e tabelas de frete) e o armazenamento do seu próprio navegador (políticas, docas, histórico). O objetivo é ter uma única base compartilhada por todos os usuários.

## Como os polígonos serão guardados

Cada polígono vira **uma linha** na tabela, não um arquivo grande. O desenho é gravado num formato geográfico nativo do banco (PostGIS), que é compacto, indexado e permite perguntas como "qual polígono contém este ponto?" direto no servidor — foi a opção que você escolheu.

O mapa continua recebendo o desenho em GeoJSON: o banco converte na hora da leitura, e enviamos ao navegador só os polígonos das lojas visíveis, com uma versão simplificada para desenho rápido. O contorno original fica preservado para cálculos.

## Estrutura das tabelas

```text
stores            lojas (nome, regional SP/RJ, endereço, coordenada)
  └─ polygons     1 linha por polígono: loja, tipo (Entrega/Retira),
                  faixa/raio, distrito, área, centro, desenho geográfico
  └─ docks        docas da loja
  └─ policies     políticas de envio (todos os campos do cadastro atual:
                  tipo, modalidades, dimensões, fins de semana, ponto de
                  retirada, janelas/coletas, entrega agendada, ativa)
       ├─ policy_docks     ligação política ↔ doca
       └─ freight_tables   tabela de frete da política
             └─ freight_bands  faixas de peso (início, fim, preço base,
                               adicional/kg, %, volume, prazo, seguro)
audit_log         histórico: data/hora, loja, aba, campo, antes, depois,
                  ação, descrição
```

Polígonos de Retira (contorno estadual) entram na mesma tabela `polygons`, marcados com tipo `Retira` e sem loja, ligados à regional.

## Envio de polígonos vira upload real

A aba "Envio de Polígonos" deixa de apenas ativar lojas fixas e passa a:

1. escolher (ou cadastrar) a loja e a regional;
2. escolher o tipo: Entrega ou Retira;
3. selecionar um arquivo `.geojson` do computador;
4. mostrar a pré-visualização: quantas áreas foram lidas, nomes encontrados, avisos de geometria inválida;
5. confirmar e gravar no banco.

O banco começa vazio — você popula enviando os arquivos de cada loja. Nada é inventado: se o arquivo não tiver um campo esperado, o sistema avisa em vez de preencher sozinho. Também dá para remover o envio de uma loja.

## Acesso

Sem login por enquanto, como você pediu: os perfis Consultor / Editor / Auditor continuam sendo uma escolha na tela. Vale saber que, sem login, qualquer pessoa com o endereço do site pode gravar no banco — os perfis organizam a tela, não protegem os dados. Quando quiser, ligamos login e amarramos as permissões aos mesmos três perfis.

## O que muda na tela

- Dashboard, Políticas, Cadastro, Docas, Auditoria passam a ler e gravar no banco, com indicadores de carregando/erro.
- Cadastros feitos por uma pessoa aparecem para as outras ao recarregar.
- Nada do que existe no seu navegador é migrado automaticamente; o banco parte limpo e é populado pelos envios.
- Layout, fluxo de cadastro, replicação de política, pop-ups e cálculo de frete continuam iguais.

## Detalhes técnicos

- Extensão `postgis`; coluna `geometry(MultiPolygon, 4326)` com índice GiST; leitura via view/RPC com `ST_AsGeoJSON` e `ST_SimplifyPreserveTopology` para renderização.
- Escrita do GeoJSON enviado através de server function (`createServerFn`), convertendo com `ST_GeomFromGeoJSON`; parsing e validação do arquivo no cliente antes do envio, em lotes para arquivos grandes (o conjunto atual tem ~2.500 polígonos / 2,5 MB).
- Tabelas em `public` com GRANTs para `anon`/`authenticated` e RLS habilitada com políticas permissivas explícitas enquanto não há login.
- Os stores em `src/lib/freight/*-store.ts` (políticas, docas, tarifas, auditoria, lojas enviadas) trocam `localStorage` por TanStack Query sobre server functions, mantendo a mesma API para os componentes.
- `freight-data.json` deixa de ser a fonte do dashboard; fica apenas como arquivo de referência/importação.
