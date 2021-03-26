/**
 * Gwp - functionality for GWP promotions
 *
 * TO USE: add GWP settings to settings_schema
 *
 * TO DO: add more information
 *
 * @param  {type} function( description
 * @return {type}           description
 */
var Gwp = (function() {
  var selectors = {
    drawer: '#CartDrawer',
    container: '#CartContainer',
    template: '#CartTemplate',
    cartBubble: '#CartBubble',
    qtySelector: '.js-qty__wrapper',
    cartHeader: '.drawer__fixed-header',
  };

  var classes = {
    gwpContentWrapper: 'gwp-content-wrapper',
    sliderWrapper: 'gwp-slider-wrapper',
  }

  var state = {
    loading: false,
    aboveThreshold: false,
  };

  function Gwp() {
    // if the theme setting is unchecked, bail
    if ('{{ settings.gwp_enable }}' !== 'true') {
      return false;
    }

    // need to make this a string to run it through the compiler
    var productIdsString = '{{ settings.gwp_product_ids }}';

    this.cartContainer = document.querySelector(selectors.container);
    this.cartSubtotal = 0;
    this.drawer = document.querySelector(selectors.drawer);
    this.cartHeader = this.drawer.querySelector(selectors.cartHeader);
    this.gwpInCart = false;
    this.productIdsArray = productIdsString.replace(/ /g,'').split(',');
    this.threshold = parseFloat('{{ settings.gwp_threshold }}') * 100;

    this.init();

    // TODO:
    // output prods in cart
    // add slider func.
  }

  Gwp.prototype = Object.assign({}, Gwp.prototype, {
    initEventListeners: function() {
      this.drawer.addEventListener('click', this.addItem.bind(this));

      // check if there is a GWP in the cart every time it's built
      document.addEventListener('cart:updated', function(e) {
        var cart = e.detail.cart;

        this.cartSubtotal = cart.original_total_price;

        this.checkThreshold();
        this.checkForGwp(cart);
      }.bind(this));
    },

    checkThreshold: function() {
      if (this.cartSubtotal >= this.threshold) {
        state.aboveThreshold = true;
      } else {
        state.aboveThreshold = false;
      }
    },

    checkForGwp: function(cart) {
      // reset state
      this.gwpInCart = false;

      for (var i = 0; i < cart.items.length; i++) {
        var item = cart.items[i];

        if (!!item.properties && !!item.properties._is_gwp) {
          this.gwpInCart = true;
        }
      }

      if (!!this.gwpProducts) {
        this.renderContent();
      }
    },

    addItem: function(e) {
      // loop parent nodes from the target to the delegation node
      for (var target = e.target; target && target != this; target = target.parentNode) {
        if (target.matches('.gwp__atc')) {
          e.preventDefault();

          if (state.loading) {
            return;
          }

          // Loading indicator on add to cart button
          target.classList.add('btn--loading');

          state.loading = true;

          var variantData = {
            items: [
              {
                quantity: 1,
                id: target.dataset.id,
                properties: {
                  _is_gwp: true
                }
              }
            ]
          };

          fetch(theme.routes.cartAdd, {
            method: 'POST',
            body: JSON.stringify(variantData),
            headers: {
              'Content-Type': 'application/json'
            }
          })
          .then(function(data) {
            if (data.status === 422) {
              console.error('Error:', error);
            } else {
              this.success();
            }

            state.loading = false;
            target.classList.remove('btn--loading');
          }.bind(this))
          .catch((error) => {
            console.error('Error:', error);
          });

          break;
        }
      }
    },

    success: function() {
      document.dispatchEvent(new CustomEvent('ajaxProduct:added', {
        detail: {
          addToCartBtn: null
        }
      }));
    },

    getProducts: function (productIdsArray) {
      return new Promise(function(resolve, reject) {
        var encodedIdsString = '';

        for (var i = 0; i < productIdsArray.length; i++) {
          var encodedId = btoa("gid://shopify/Product/" + productIdsArray[i]);
          encodedIdsString = encodedIdsString + '"' + encodedId + '"' + ',';
        }

        var mutation = `
        query {
          nodes(ids: [${encodedIdsString}]) {
            ... on Product {
              id
              variants(first: 1) {
                edges {
                  node {
                    id
                    availableForSale
                  }
                }
              }
              title
              images (first: 1) {
                edges {
                  node {
                    id
                    originalSrc
                  }
                }
              }
            }
          }
        }
        `;

        var settings = {
          'async': true,
          'crossDomain': true,
          'headers': {
            'X-Shopify-Storefront-Access-Token': '6e3a3da710a0280b64a6e72f14554d74',
            'Content-Type': 'application/graphql',
          },
          'data': mutation
        };

        var request = new XMLHttpRequest();
        request.open('POST', '/api/graphql', true);
        request.setRequestHeader('Content-Type', 'application/graphql');
        request.setRequestHeader('X-Shopify-Storefront-Access-Token', '6e3a3da710a0280b64a6e72f14554d74',);
        request.send(mutation);

        request.onload = function() {
          if (this.status >= 200 && this.status < 400) {
            // Success!
            resolve(this.response);
          } else {
            reject(new Error('error'));
          }
        };
      });
    },

    renderContent: function() {
      if (!!this.gwpInCart) {
        // GWP in cart
        this.removeGwpSelection();
      } else {
        // no GWP in cart
        this.removeGwpSelection();
        this.addGwpSelection();
      }
    },

    addGwpSelection: function() {
      var gwpContentWrapper = document.createElement('div');
      gwpContentWrapper.classList.add(classes.gwpContentWrapper);

      if (state.aboveThreshold) {
        var productNodes = this.gwpProducts.data.nodes;
        var slideCount = productNodes.length;
        var gwpContents = '';

        gwpContents += `
          <div class="text-center">
            <p>{{ settings.gwp_unlocked }}</p>
          </div>
          <div class="${classes.sliderWrapper}">
        `;

        for (var i = 0; i < productNodes.length; i++) {
          var productNode = productNodes[i];
          var title = productNode.title;
          var variantId = (atob(productNode.variants.edges[0].node.id)).replace('gid://shopify/ProductVariant/', '');
          var image = productNode.images.edges[0].node.originalSrc;

          gwpContents += `
            <div class="gwp__slide">
              <div class="grid">
                <div class="grid__item one-third">
                  <img src="${image}" alt="${title}">
                </div>

                <div class="grid__item two-thirds">
                  <p>${title}</p>

                  <div class="grid grid--full display-table">
                    <div class="grid__item display-table-cell one-whole">
                      <a href="/cart/add?id=${variantId}" class="gwp__atc btn btn--small" data-id="${variantId}">Add to Cart</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
        }

        gwpContents += `</div>`;
        gwpContentWrapper.innerHTML = gwpContents;

      } else {
        var difference = theme.Currency.formatMoney(this.threshold - this.cartSubtotal, theme.settings.moneyFormat);

        var spendMoreText = '{{ settings.gwp_spend_more }}';
        spendMoreText = spendMoreText.replace('[money]', difference);

        gwpContentWrapper.innerHTML = `
          <div class="text-center">
            <p><strong>{{ settings.gwp_free_gift_title }}</strong></p>
            <p>${spendMoreText}</p>
            <progress max="${this.threshold}" value="${this.cartSubtotal}" style="width: 100%"></progress>
          </div>
        `;
      }

      // append content to template
      this.cartHeader.insertAdjacentElement('afterend', gwpContentWrapper);

      // slider
      if (slideCount > 1) {
        var sliderArgs = {
          prevNextButtons: true,
          pageDots: false,
          fade: false,
          setGallerySize: false,
          autoPlay: false
        };

        var slider = document.querySelector(`.${classes.sliderWrapper}`);
        var flickity = new theme.Slideshow(slider, sliderArgs);
      }
    },

    removeGwpSelection: function() {
      var gwpContentWrapper = document.querySelectorAll(`.${classes.gwpContentWrapper}`);

      for (var i = 0; i < gwpContentWrapper.length; i++) {
        gwpContentWrapper[i].parentNode.removeChild(gwpContentWrapper[i]);
      }
    },

    init: function() {
      this.initEventListeners();

      var promise = this.getProducts(this.productIdsArray);
      promise.then(function(result) {
        // build products object for later use
        this.gwpProducts = JSON.parse(result);

        theme.cart.getCart().then(function(cart) {
          this.checkForGwp(cart);
        }.bind(this));

      }.bind(this));
    },
  });

  return Gwp;
})();

module.exports = Gwp;
