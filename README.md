# Freight Zone Explorer

Dashboard Interativo de Áreas de Frete — Aricanduva e Suzano

Crie um dashboard web interativo e visualmente profissional para análise das áreas de atendimento de duas lojas: Aricanduva e Suzano.

O dashboard deverá utilizar dois arquivos GeoJSON contendo os polígonos das áreas de cada loja e duas planilhas Excel contendo as regras de preço de frete.

1. Mapa

O elemento principal do dashboard deve ser um mapa interativo, utilizando um mapa-base com ruas e localização geográfica para facilitar a visualização dos polígonos.

Preferencialmente, utilizar Google Maps como mapa-base, desde que isso seja tecnicamente e legalmente viável. Caso a integração direta com Google Maps exija uma API Key ou outra configuração externa, deixar a estrutura preparada para utilização da chave, sem quebrar o funcionamento do dashboard.

O mapa deve permitir:

Zoom in e zoom out;

Arrastar/pan;

Visualizar os nomes/localizações das lojas;

Visualizar os polígonos dos dois GeoJSONs;

Ativar e desativar cada camada individualmente;

Visualizar as duas lojas simultaneamente;

Visualizar somente Aricanduva;

Visualizar somente Suzano;

Comparar visualmente as áreas das duas lojas;

Ajustar automaticamente o enquadramento do mapa para os polígonos selecionados.

2. Controle das lojas

Criar um controle no dashboard para selecionar:

Aricanduva

Suzano

Ambas

Quando somente uma loja estiver selecionada, mostrar apenas seus respectivos polígonos.

Quando "Ambas" estiver selecionado, mostrar os dois GeoJSONs simultaneamente, permitindo identificar visualmente a qual loja cada polígono pertence.

3. Identificação dos polígonos

Cada polígono do GeoJSON deve ser tratado individualmente.

Ao passar o mouse sobre um polígono, apresentar um tooltip contendo, no mínimo:

Loja;

Nome/identificação do polígono;

Faixa de distância/raio, caso essa informação esteja presente no GeoJSON;

Peso inicial da faixa;

Peso final da faixa;

Preço base do frete;

Incremento por kg excedente;

Preço calculado do frete.

Ao clicar em um polígono, abrir um painel ou popup com essas informações de forma mais detalhada.

4. Integração com as planilhas Excel

As duas planilhas Excel devem ser utilizadas como fonte das regras de preço de frete.

Não apenas exibir os valores existentes na planilha: o dashboard deve relacionar corretamente cada polígono à regra de preço correspondente.

Para determinar o preço do frete, considerar os seguintes campos da planilha:

Weight_Start → peso inicial da faixa, em kg;

Weight_End → peso final da faixa, em kg;

AbsoluteMoneyCost → preço base/inicial do frete para aquela faixa, em reais;

PriceByExtraWeight → valor adicional cobrado por kg excedente.

5. Cálculo do preço

Implementar a lógica de cálculo do frete utilizando as faixas de peso existentes nas planilhas.

Para cada faixa:

Peso dentro da faixa:

Weight_Start <= Peso <= Weight_End

O preço base da faixa deve ser obtido através de:

AbsoluteMoneyCost

Caso o peso ultrapasse o peso máximo da faixa, calcular o adicional utilizando:

Peso Excedente × PriceByExtraWeight

Portanto, quando aplicável:

Preço do frete = AbsoluteMoneyCost + (Peso Excedente × PriceByExtraWeight)

O dashboard deve deixar clara a diferença entre:

preço inicial da faixa;

peso incluído na faixa;

peso excedente;

custo adicional por kg;

preço final calculado.

6. Visualização dos preços por faixa

O usuário deve conseguir visualizar o valor do frete para cada faixa de peso.

Criar uma tabela ou painel contendo, por exemplo:

Faixa de pesoPeso inicialPeso finalPreço baseAdicional/kgPreço calculado

Os valores devem ser obtidos diretamente das planilhas Excel.

A tabela deve ser atualizada conforme a loja/polígono selecionado.

7. Associação entre GeoJSON e Excel

Criar uma lógica clara para associar cada polígono às informações de frete da respectiva planilha.

A associação deve considerar os identificadores disponíveis nos arquivos, como:

nome da loja;

nome/ID do polígono;

faixa de raio;

faixa de peso;

ou outros campos presentes nos arquivos.

Não assumir que a ordem das linhas dos arquivos corresponde à ordem dos polígonos.

A relação deve ser feita utilizando os campos/identificadores existentes nos dados.

Se houver divergência ou ausência de correspondência entre um polígono e uma regra de frete, o dashboard deve indicar claramente:

"Regra de frete não encontrada"

em vez de inventar ou estimar um valor.

8. Filtros

Adicionar filtros interativos para:

Loja;

Faixa de raio/distância;

Faixa de peso;

Preço do frete;

Polígono.

Os filtros devem atualizar automaticamente o mapa e as informações exibidas.

9. Legenda

Criar uma legenda clara para os polígonos.

As áreas devem possuir diferenciação visual suficiente para identificar:

Aricanduva;

Suzano;

diferentes faixas de raio, caso existam.

Quando as duas lojas estiverem sendo exibidas simultaneamente, deve ser possível distinguir facilmente os polígonos de cada loja.

10. Indicadores do dashboard

Adicionar cards de indicadores no topo da página contendo:

Loja selecionada;

Quantidade de polígonos;

Menor preço de frete;

Maior preço de frete;

Preço médio de frete;

Quantidade de faixas de peso;

Área total dos polígonos, se essa informação puder ser calculada com segurança.

Os indicadores devem ser atualizados dinamicamente conforme os filtros.

11. Interatividade

O dashboard deve ser totalmente interativo.

Exemplo de comportamento esperado:

Usuário seleciona Aricanduva;

O mapa mostra somente os polígonos de Aricanduva;

Usuário passa o mouse sobre um polígono;

O tooltip mostra a identificação do polígono e sua faixa;

O dashboard identifica a regra de frete correspondente nas planilhas;

São exibidos os valores de Weight_Start, Weight_End, AbsoluteMoneyCost e PriceByExtraWeight;

O usuário pode selecionar uma faixa de peso;

O preço correspondente é calculado e exibido;

Ao selecionar Suzano, todo o conteúdo é atualizado para os dados de Suzano;

Ao selecionar Ambas, as duas lojas são exibidas simultaneamente.

12. Interface

Criar uma interface moderna, limpa e profissional, adequada para utilização empresarial.

Estrutura sugerida:

Topo

Título: "Dashboard de Frete — Aricanduva x Suzano"

Cards de indicadores

Lateral esquerda

Filtros

Seleção de loja

Faixa de peso

Faixa de raio

Área central

Mapa interativo ocupando a maior parte da tela

Lateral direita ou área inferior

Informações do polígono selecionado

Regras de frete

Tabela de preços por faixa

13. Requisitos técnicos

O dashboard deve:

Ser responsivo;

Funcionar em navegador;

Possuir código organizado;

Separar a lógica de processamento dos dados da interface;

Não alterar os arquivos GeoJSON ou Excel originais;

Carregar os dados dinamicamente;

Tratar valores nulos ou ausentes;

Tratar polígonos inválidos sem quebrar o dashboard;

Exibir mensagens claras quando houver dados inconsistentes.

14. Regra importante sobre os dados

Não inventar valores de frete.

Todos os preços devem ser derivados dos dados existentes nas planilhas Excel e associados aos polígonos através dos identificadores disponíveis nos arquivos.

Antes de implementar o dashboard, analisar a estrutura dos dois GeoJSONs e das duas planilhas Excel, identificar quais campos podem ser utilizados para fazer a associação e então implementar a regra de relacionamento.

Se os arquivos possuírem estruturas diferentes entre Aricanduva e Suzano, tratar cada estrutura corretamente sem assumir que os campos possuem exatamente a mesma organização.

O resultado final deve permitir que um usuário selecione uma loja, visualize suas áreas no mapa e, ao interagir com qualquer polígono, consiga entender qual é o preço de frete aplicável e como esse preço foi calculado para cada faixa de peso.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dashboard-sa.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/68d0287e-cbd1-4d3d-bd9a-b1685f382d24).

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
