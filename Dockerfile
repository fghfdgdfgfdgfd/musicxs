FROM nginx:1.27-alpine

# Railway sets $PORT at runtime; nginx fills it into the config on start.
ENV PORT=8080

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY index.html /usr/share/nginx/html/index.html
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js

EXPOSE 8080
