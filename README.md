# Site da Construtora Dallo

Site estático de 147 páginas — 49 páginas em três idiomas (português, inglês e
espanhol) — gerado por um script Node único a partir do conteúdo da Dallo.

```
node gerar.js
```

O comando reescreve todo o HTML. **Editar os arquivos `.html` à mão não faz
sentido: a próxima geração os sobrescreve.** Qualquer mudança de conteúdo ou de
estrutura é feita em `gerar.js`.

## O que é cada coisa

| caminho | o que é |
| --- | --- |
| `gerar.js` | o gerador: monta as 147 páginas, os três idiomas e o SEO |
| `servir.js` | servidor local para abrir o site durante o desenvolvimento |
| `css/estilo.css` | folha principal |
| `css/abertura.css` | só a primeira dobra (vídeo de fundo, busca, escurecimento) |
| `js/site.js` | troca de idioma, filtros da listagem, carregamento do vídeo |
| `js/abertura.js` | a marca desenhada em SVG e a animação de entrada |
| `midia/web/` | fotos em WebP, duas larguras (820 e 1600 px), com `srcset` |
| `midia/midia-site/static/` | vídeos |
| `fontes/` | Manrope, Montserrat e Playfair Display (licença SIL OFL) |

## Idiomas

As páginas em português ficam na raiz; inglês em `en/` e espanhol em `es/`.
Os três conjuntos saem da mesma geração e se apontam por `hreflang`.

## Direitos

As fotografias, os textos institucionais, a marca e os nomes dos
empreendimentos são da **Construtora Dallo**. O código deste repositório está
aberto para leitura, mas o material da Dallo não é livre para reuso.

As traduções para inglês e espanhol foram feitas durante a construção do site e
ainda não passaram por revisão da Dallo.
