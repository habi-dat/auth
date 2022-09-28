<template>
  <v-form
    ref="form"
    v-model="valid"
    @input="$emit('valid', valid)">
    <v-text-field
      ref="passwordRepeat"
      prepend-icon="lock"
      type="password"
      v-model="currentPassword"
      autocomplete="current-password"
      label="dein aktuelles Passwort"
      required>
    </v-text-field>
    <v-divider />
    <PasswordFields
      v-model="password"
      :label="passwordLabel"
      required="true"
    />
  </v-form>
</template>

<script>

import axios from 'axios'
import router from '@/router'
import PasswordFields from '@/components/form/PasswordFields'

export default {
  props: {
    user: Object
  },
  components: { PasswordFields },
  data() {
    return {
      valid: true,
      password: '',
      currentPassword: '',
      passwordLabel: 'neues Passwort'
    }
  },
  created() {
    if (this.user) {
      this.passwordLabel += ' für ' + this.user.cn
    }
  }
}
</script>