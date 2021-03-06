require('app/models/funding_instrument');

Balanced.Card = Balanced.FundingInstrument.extend(Ember.Validations, {
	uri: '/cards',

	validations: {
		number: {
			presence: true,
			format: {
				validator: function(object, attribute, value) {
					if (!balanced.card.isCardNumberValid(value)) {
						object.get('validationErrors').add(attribute, 'blank', null, 'is not valid');
					}
				}
			}
		},
		expiration_month: {
			presence: true
		},
		expiration_year: {
			presence: true
		},
		security_code: {
			presence: true,
			numericality: true,
			length: {
				minimum: 3,
				maximum: 4
			}
		}
	},

	type_name: function() {
		return 'Card';
	}.property(),

	route_name: function() {
		return 'cards';
	}.property(),

	is_bank_account: false,

	appears_on_statement_max_length: function() {
		return Balanced.MAXLENGTH.APPEARS_ON_STATEMENT_CARD;
	}.property(),

	last_four: function() {
		var accountNumber = this.get('number');
		if (!accountNumber || accountNumber.length < 5) {
			return accountNumber;
		} else {
			return accountNumber.substr(accountNumber.length - 4, 4);
		}
	}.property('account_number'),

	description: function() {
		return '%@ (%@)'.fmt(
			this.get('last_four'),
			Balanced.Utils.toTitleCase(this.get('brand'))
		);
	}.property('last_four', 'brand'),

	displayName: function() {
		return '%@ (%@ %@)'.fmt(
			this.get('name'),
			this.get('last_four'),
			Balanced.Utils.toTitleCase(this.get('brand'))
		);
	}.property('name', 'last_four', 'brand'),

	human_readable_expiration: function() {
		return this.get('expiration_month') + '/' + this.get('expiration_year');
	}.property('expiration_month', 'expiration_year'),

	tokenizeAndCreate: function(customerId) {
		var self = this;
		var promise = this.resolveOn('didCreate');

		this.set('isSaving', true);
		var cardData = {
			number: this.get('number'),
			expiration_month: this.get('expiration_month'),
			expiration_year: this.get('expiration_year'),
			security_code: this.get('security_code'),
			name: this.get('name'),
			postal_code: this.get('postal_code')
		};

		// Tokenize the card using the balanced.js library
		balanced.card.create(cardData, function(response) {
			if (response.errors) {
				var validationErrors =
					self.set('validationErrors', Balanced.Utils.extractValidationErrorHash(response));

				if (!validationErrors) {
					self.set('displayErrorDescription', true);
					var errorSuffix = (response.errors && response.errors.length > 0 && response.errors[0].description) ? (': ' + response.errors[0].description) : '.';
					self.set('errorDescription', 'Sorry, there was an error tokenizing this card' + errorSuffix);
				}

				self.set('isSaving', false);
				promise.reject();
			} else {
				Balanced.Card.find(response.cards[0].href)

				// Now that it's been tokenized, we just need to associate it with the customer's account
				.then(function(card) {
					card.set('links.customer', customerId);

					card.save().then(function() {
						self.set('isLoaded', true);
						self.set('isNew', false);
						self.set('isSaving', false);
						self.trigger('didCreate');
					}, function() {
						self.set('displayErrorDescription', true);
						self.set('errorDescription', 'Sorry, there was an error associating this card.');
						self.set('isSaving', false);
						promise.reject();
					});
				});
			}
		});

		return promise;
	}
});

Balanced.TypeMappings.addTypeMapping('card', 'Balanced.Card');
