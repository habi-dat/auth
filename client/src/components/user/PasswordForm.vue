<template>
  <v-form
    ref="form"
    v-model="valid"
    @input="$emit('valid', valid)">
    <v-text-field
      v-if="checkPassword"
      ref="passwordRepeat"
      prepend-icon="lock"
      type="password"
      :value="currentPassword"
      @input="value => $emit('update:currentPassword', value)"
      autocomplete="current-password"
      :label="passwordLabelCurrent"
      :append-outer-icon="showPw ? 'visibility' : 'visibility_off'"
      :type="showPw ? 'text' : 'password'"
      @click:append-outer="showPw = !showPw"
      required>
    </v-text-field>
    <v-divider v-if="checkPassword"/>
    <PasswordFields
      :value="password"
      @input="value => $emit('update:password', value)"
      :label="passwordLabel"
      required
    />
  </v-form>
</template>

<script>

import axios from 'axios'
import router from '@/router'
import PasswordFields from '@/components/form/PasswordFields'

export default {
  props: {
    user: Object,
    password: String,
    currentPassword: String,
    checkPassword: Boolean
  },
  components: { PasswordFields },
  data() {
    return {
      valid: true,
      passwordLabel: 'neues Passwort',
      passwordLabelCurrent: 'aktuelles Passwort',
      showPw: false
    }
  },
  created() {
    if (this.user) {
      this.passwordLabel += ' für ' + this.user.cn
      this.passwordLabelCurrent = 'dein Passwort'
    }
  }
}
</script>