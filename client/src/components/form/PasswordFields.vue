<template>
  <v-row>
    <v-col>
      <v-text-field
        ref="password"
        prepend-icon="lock"
        :append-outer-icon="showPw ? 'visibility' : 'visibility_off'"
        :type="showPw ? 'text' : 'password'"
        @click:append-outer="showPw = !showPw"
        :rules="[passwordRequired, passwordStrongEnough]"
        v-model="passwordValue"
        @input="onInput"
        autocomplete="new-password"
        :label="label || 'Passwort'"
        loading
        @keydown.tab.exact.prevent="focus('passwordRepeat')"
        :required="required">
        <template v-slot:progress>
          <v-progress-linear
            :color="score.color || 'black'"
            :value="score.value || 0"
            absolute
            height="1"
          >
          </v-progress-linear>
        </template>
        <template v-slot:append>
          <v-icon
            :color="score.color"> {{ score.strengthIcon }}
          </v-icon>
        </template>
        <template v-slot:append-outer>
          <v-icon @mouseup.stop @click.prevent.stop="showPw = !showPw"> {{ showPw ? 'visibility' : 'visibility_off' }} </v-icon>
        </template>
        </v-progress-linear>
      </v-text-field>
      <v-text-field
        ref="passwordRepeat"
        prepend-icon="_"
        append-outer-icon="_"
        :type="showPw ? 'text' : 'password'"
        v-model="passwordRepeat"
        :rules="[passwordConfirmationRule]"
        autocomplete="new-password"
        label="Passwort - Bestägigung"
        @keydown.tab.shift.exact.prevent="focus('password')"
        :required="required">
      </v-text-field>
    </v-col>
  </v-row>
</template>

<script>
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core'
import zxcvbnCommonPackage from '@zxcvbn-ts/language-common'
import zxcvbnDePackage from '@zxcvbn-ts/language-de'

export default {
  name: 'PasswordFields',
  props: {
    password: String,
    required: Boolean,
    label: String
  },
  data () {
    return {
      score: { suggestions: '', score: 5},
      showPw: false,
      passwordRepeat: '',
      passwordValue: '',
    };
  },
  methods: {
    focus(field) {
      this.$refs[field].focus()
    },
    onInput(value) {
      this.updateScore(value);
      this.$emit('input', value)
    },
    updateScore(password) {
      var result = zxcvbn(password)
      this.score.value = result.score * 25;
      this.score.score = result.score +1;
      if (!!!password) {
        this.score.color = 'black'
        this.score.strengthIcon = '';
      } else if (result.score === 0) {
        this.score.color = 'error';
        this.score.strengthIcon = 'looks_one';
      } else if (result.score == 1) {
        this.score.color = 'error'
        this.score.strengthIcon = 'looks_two';
      } else if (result.score == 2) {
        this.score.color = 'warning'
        this.score.strengthIcon = 'looks_3';
      } else if (result.score == 3) {
        this.score.color = 'success'
        this.score.strengthIcon = 'looks_4';
      } else if (result.score == 4) {
        this.score.color = 'success'
        this.score.strengthIcon = 'looks_5';
      }
      if (result.feedback.warning) {
        this.score.suggestions = "\n (Hinweis: " + result.feedback.warning + ')'
      } else {
        this.score.suggestions = '';
      }
      this.$refs.passwordRepeat.validate();
    },
  },
  computed: {
    passwordRequired() {
      return () => !this.required || !!this.passwordValue ||  'Bitte Passwort angeben'
    },
    passwordConfirmationRule() {
      return () => !!!this.passwordValue && !!!this.passwordRepeat || this.passwordValue === this.passwordRepeat || 'Passwörter müssen übereinstimmen'
    },
    passwordStrongEnough() {
      return () => !this.required && !!!this.passwordValue || (this.score.score > 3) || 'mindestens Passwortstärke 4' + this.score.suggestions;
    }
  },
  created() {
    this.passwordValue = this.password;
    const options = {
      translations: zxcvbnDePackage.translations,
      graphs: zxcvbnCommonPackage.adjacencyGraphs,
      dictionary: {
        ...zxcvbnCommonPackage.dictionary,
        ...zxcvbnDePackage.dictionary,
      },
    }
    zxcvbnOptions.setOptions(options)
  },
};

</script>