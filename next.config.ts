import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /*
     * O padrão é 1 MB, e ele cortava o envio antes de qualquer validação
     * nossa rodar: a foto sumia com erro 500 sem texto, e nada era salvo.
     *
     * A avaliação manda até seis fotos num envio só. Cada uma chega reduzida
     * pelo navegador (ver `comprimir-foto.ts`), com 200 a 500 KB, então seis
     * cabem aqui com folga. O teto da Vercel para o corpo da requisição é de
     * 4,5 MB, e é por isso que este número não sobe mais: acima disso o corte
     * volta a acontecer fora do nosso alcance, na plataforma.
     */
    serverActions: { bodySizeLimit: '4mb' },
  },

  async headers() {
    return [
      {
        /*
         * A arte das telas de acesso é o primeiro pixel do produto: ela precisa
         * estar na tela junto com o texto, não depois dele.
         *
         * O padrão do Next para `public/` é `max-age=0`, que na segunda visita
         * ainda custa uma ida ao servidor para ouvir "não mudou". Aqui o
         * conteúdo é fixo, então vale o cache eterno — arte nova entra com nome
         * novo, nunca sobrescrevendo o mesmo arquivo.
         */
        source: "/acesso/:arquivo*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
