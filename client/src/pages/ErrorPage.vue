<template>
  <v-alert icon="error" prominent outlined type="error">
    Der Server ist leider offline. Versuche es in wenigen Momenten nochmal.
  </v-alert>
</template>

<script>
import router from '../router'
import axios from 'axios'
export default {
  name: 'ErrorPage',
  data () {
    return {
    }
  }
}
</script>
