<template>
  <v-text-field
    prepend-icon="email"
    :disabled="disabled"
    :rules="[v => /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/.test(v) || 'keine gültige E-Mailadresse' ]"
    :error-messages="errors"
    @change="checkMailAvailability"
    :value="value"
    @input="val => $emit('input', val)"
    label="E-Mailadresse">
  </v-text-field>
</template>


<script>
import axios from 'axios'

export default {
  name: 'EmailField',
  props: {
    disabled : Boolean,
    value: String,
    checkAvailability: Boolean
  },
  data() {
    return {
      errors: [],
      oldValue: null
    }
  },
  methods: {
    async checkMailAvailability (uid) {
      this.errors = []
      if (this.checkAvailability) {
        if (this.oldValue !== this.value) {
          try {
            await axios.get('/api/user/available/mail/' + this.value)
              .then(response => {
                if(!response.data.available) {
                  this.errors.push('Diese E-Mailadresse wird bereits von einem anderen Account verwendet')
                }
              })
          } catch(error) {}
        }
      }
    },
  },
  created() {
    this.oldValue = this.value;
  }
};

</script>