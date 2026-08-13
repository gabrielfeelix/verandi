import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
