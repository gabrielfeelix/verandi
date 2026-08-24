import { describe, it, expect } from 'vitest'
import {
  chavesDeBusca,
  erroDoTelefone, exibirTelefone, mascararTelefone, normalizarTelefone,
  telefoneValido,
} from '@/core/telefone'

describe('telefone', () => {
  it('aceita vazio: 30% dos cadastros reais não têm telefone', () => {
    expect(erroDoTelefone('')).toBeNull()
    expect(erroDoTelefone(null)).toBeNull()
    expect(erroDoTelefone('   ')).toBeNull()
  })

  it('recusa o número sem DDD, que é o formato da planilha antiga', () => {
    // "9.8109-1840" é exatamente como o MGM escreve na lista de turma
    expect(erroDoTelefone('9.8109-1840')).toMatch(/DDD/)
    expect(erroDoTelefone('3344-5566')).toMatch(/DDD/)
  })

  it('aceita fixo com DDD e celular com o nono dígito', () => {
    expect(telefoneValido('(44) 3344-5566')).toBe(true)
    expect(telefoneValido('44988776655')).toBe(true)
  })

  it('recusa DDD que não existe', () => {
    // 10 e 20 não são DDD de lugar nenhum; quem digitou trocou um dígito
    expect(erroDoTelefone('1098765432')).toMatch(/não é um DDD/)
    expect(erroDoTelefone('20987654321')).toMatch(/não é um DDD/)
  })

  it('recusa celular de 11 dígitos que não começa com 9', () => {
    expect(erroDoTelefone('44888776655')).toMatch(/começa com 9/)
  })

  it('escreve a máscara enquanto se digita, sem travar no meio', () => {
    expect(mascararTelefone('4')).toBe('4')
    expect(mascararTelefone('44')).toBe('44')
    expect(mascararTelefone('4498')).toBe('(44) 98')
    expect(mascararTelefone('4498877')).toBe('(44) 9887-7')
    expect(mascararTelefone('44988776655')).toBe('(44) 98877-6655')
    // e não deixa passar do tamanho de um telefone brasileiro
    expect(mascararTelefone('449887766551234')).toBe('(44) 98877-6655')
  })

  it('guarda só dígitos, porque a máscara é da tela', () => {
    expect(normalizarTelefone('(44) 98877-6655')).toBe('44988776655')
    expect(normalizarTelefone('')).toBeNull()
  })
})

/**
 * A ficha mostrava `(98) 5285-028` e, logo abaixo, "Falta o DDD". As duas
 * coisas não podem ser verdade ao mesmo tempo: os parênteses afirmam que 98 é
 * DDD, e a nota afirma que não há DDD nenhum. Quem lê conclui que o sistema
 * está errado sobre um número que ele mesmo escreveu.
 */
describe('exibirTelefone', () => {
  it('põe DDD entre parênteses quando ele existe de verdade', () => {
    expect(exibirTelefone('44999999999')).toBe('(44) 99999-9999')
    expect(exibirTelefone('4433334444')).toBe('(44) 3333-4444')
  })

  it('marca o DDD que falta com XX, em vez de promover os dois primeiros dígitos', () => {
    // nove dígitos é celular sem DDD: 98528-5028, e não DDD 98
    expect(exibirTelefone('985285028')).toBe('(XX) 98528-5028')
    expect(exibirTelefone('33334444')).toBe('(XX) 3333-4444')
  })

  it('não inventa formato para número de tamanho impossível', () => {
    expect(exibirTelefone('123')).toBe('123')
    expect(exibirTelefone('')).toBe('')
  })
})

/**
 * O bot chega com o identificador do WhatsApp e precisa achar a ficha.
 *
 * É o que faz a conversa começar com "Oi, Marina!" em vez de "qual seu nome?"
 * para quem faz aula aqui há dois anos.
 */
describe('chavesDeBusca', () => {
  it('tira o país, que o WhatsApp manda e o cadastro não guarda', () => {
    expect(chavesDeBusca('5544998887766')).toContain('44998887766')
  })

  it('gera a forma sem o nono dígito, porque conta antiga do WhatsApp vem assim', () => {
    expect(chavesDeBusca('5544998887766').sort()).toEqual(['4498887766', '44998887766'])
  })

  it('e a forma com o nono, quando o cadastro é que está antigo', () => {
    expect(chavesDeBusca('4498887766').sort()).toEqual(['4498887766', '44998887766'])
  })

  it('fixo não ganha nono dígito — ele nunca teve um', () => {
    expect(chavesDeBusca('4433334444')).toEqual(['4433334444'])
  })

  it('aceita máscara, porque o número pode vir digitado', () => {
    expect(chavesDeBusca('+55 (44) 99888-7766')).toContain('44998887766')
  })

  // Chutar o DDD casaria a conversa de uma pessoa com a ficha de outra. Não
  // reconhecer é caminho normal; reconhecer errado não tem conserto.
  it('não procura por número sem DDD', () => {
    expect(chavesDeBusca('998887766')).toEqual([])
    expect(chavesDeBusca('')).toEqual([])
  })

  it('não procura por DDD que não existe', () => {
    expect(chavesDeBusca('5510998887766')).toEqual([])
  })
})
