# PowerMonitor Pro ⚡

Aplicação de monitoramento remoto de energia, gerador e combustível com design premium estilo Apple.

## Como Funciona

1.  **Dashboard (`index.html`)**: Visualize em tempo real o status da energia, gerador e nível de combustível através de fotos.
2.  **Módulo Sensor (`sensor.html`)**: Este arquivo deve ser aberto no navegador de um celular que ficará permanentemente ligado à tomada no local remoto.
    *   **Energia**: O sensor detecta quando o carregador é desconectado (queda de energia).
    *   **Gerador**: O sensor utiliza o microfone para detectar ruído constante de motor.
    *   **Combustível**: O sensor tira uma foto a cada 1 minuto para que você possa ver o nível no painel.

## Requisitos

*   XAMPP (PHP + MySQL).
*   Banco de dados `energy_monitor` (já criado via script).
*   SSL (HTTPS) é necessário para que o navegador do celular permita acesso à câmera e microfone.

## Estrutura de Arquivos

*   `index.html`: Dashboard principal.
*   `sensor.html`: Página para o celular sensor.
*   `api.php`: Processa os dados recebidos.
*   `config.php`: Conexão com o banco de dados.
*   `style.css`: Estilização premium.
*   `uploads/`: Pasta onde as fotos e áudios são armazenados.

## Dica de Ouro (Produção)
Para um monitoramento 24/7 mais robusto em Android, recomenda-se o uso do app **Tasker** para enviar requisições HTTP para a `api.php` nos seguintes gatilhos:
*   State: Power Any -> Invert (Queda de energia).
*   Event: Noise (Início do gerador).
*   Time: Every 1 min (Foto).
