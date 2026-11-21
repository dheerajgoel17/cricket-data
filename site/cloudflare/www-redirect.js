export default {
  fetch(request) {
    const url = new URL(request.url);
    url.protocol = "https:";
    url.hostname = "fancy.cash";
    url.port = "";
    return Response.redirect(url, 308);
  },
};
